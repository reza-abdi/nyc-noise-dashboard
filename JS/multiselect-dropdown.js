    // Custom Multiselect Dropdown Implementation
    class CustomMultiselect {
      constructor(elementId, options, placeholder) {
        this.element = document.getElementById(elementId);
        this.options = options;
        this.placeholder = placeholder || 'Select options';
        this.selectedValues = [];
        this.init();
      }

      init() {
        this.element.innerHTML = `
          <div class="custom-multiselect-button">
            <span class="custom-multiselect-placeholder">${this.placeholder}</span>
            <div class="custom-multiselect-tags"></div>
          </div>
          <div class="custom-multiselect-dropdown">
            <input type="text" class="custom-multiselect-search" placeholder="Search...">
            <div class="custom-multiselect-selectall custom-multiselect-option">
              <input type="checkbox" id="${this.element.id}-selectall">
              <label for="${this.element.id}-selectall">Select All</label>
            </div>
            <div class="custom-multiselect-options"></div>
          </div>
        `;

        this.button = this.element.querySelector('.custom-multiselect-button');
        this.dropdown = this.element.querySelector('.custom-multiselect-dropdown');
        this.searchInput = this.element.querySelector('.custom-multiselect-search');
        this.optionsContainer = this.element.querySelector('.custom-multiselect-options');
        this.tagsContainer = this.element.querySelector('.custom-multiselect-tags');
        this.selectAllCheckbox = this.element.querySelector(`#${this.element.id}-selectall`);

        // Check if options should be loaded from hidden select element
        this.syncWithHiddenSelect();
        
        this.renderOptions();
        this.attachEvents();
      }

      syncWithHiddenSelect() {
        const hiddenSelectId = this.element.id.replace('Multiselect', 'Dropdown');
        const hiddenSelect = document.getElementById(hiddenSelectId);
        
        if (hiddenSelect && hiddenSelect.options.length > 0) {
          // Load options from hidden select
          this.options = Array.from(hiddenSelect.options).map(opt => opt.value);
          
          // Load pre-selected values
          this.selectedValues = Array.from(hiddenSelect.selectedOptions).map(opt => opt.value);
          
          // Set up mutation observer to watch for dynamically added options
          const observer = new MutationObserver(() => {
            const newOptions = Array.from(hiddenSelect.options).map(opt => opt.value);
            const newSelected = Array.from(hiddenSelect.selectedOptions).map(opt => opt.value);
            
            if (JSON.stringify(newOptions) !== JSON.stringify(this.options)) {
              this.options = newOptions;
              this.selectedValues = newSelected;
              this.renderOptions(this.searchInput ? this.searchInput.value : '');
              this.updateDisplay();
            }
          });
          
          observer.observe(hiddenSelect, { childList: true, subtree: true, attributes: true, attributeFilter: ['selected'] });
        }
      }

      refreshFromHiddenSelect() {
        const hiddenSelectId = this.element.id.replace('Multiselect', 'Dropdown');
        const hiddenSelect = document.getElementById(hiddenSelectId);
        
        if (hiddenSelect) {
          this.options = Array.from(hiddenSelect.options).map(opt => opt.value);
          this.selectedValues = Array.from(hiddenSelect.selectedOptions).map(opt => opt.value);
          this.renderOptions();
          this.updateDisplay();
        }
      }

      renderOptions(filter = '') {
        const filteredOptions = this.options.filter(opt => 
          opt.toLowerCase().includes(filter.toLowerCase())
        );

        this.optionsContainer.innerHTML = filteredOptions.map((opt, idx) => `
          <div class="custom-multiselect-option">
            <input type="checkbox" id="${this.element.id}-opt-${idx}" value="${opt}" 
              ${this.selectedValues.includes(opt) ? 'checked' : ''}>
            <label for="${this.element.id}-opt-${idx}">${opt}</label>
          </div>
        `).join('');

        this.attachOptionEvents();
      }

      attachEvents() {
        this.button.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleDropdown();
        });

        this.searchInput.addEventListener('input', (e) => {
          this.renderOptions(e.target.value);
        });

        this.selectAllCheckbox.addEventListener('change', (e) => {
          if (e.target.checked) {
            this.selectedValues = [...this.options];
          } else {
            this.selectedValues = [];
          }
          this.updateDisplay();
          this.renderOptions(this.searchInput.value);
          this.onChange();
        });

        document.addEventListener('click', (e) => {
          if (!this.element.contains(e.target)) {
            this.closeDropdown();
          }
        });
      }

      attachOptionEvents() {
        const checkboxes = this.optionsContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
          cb.addEventListener('change', (e) => {
            const value = e.target.value;
            if (e.target.checked) {
              if (!this.selectedValues.includes(value)) {
                this.selectedValues.push(value);
              }
            } else {
              this.selectedValues = this.selectedValues.filter(v => v !== value);
            }
            this.updateDisplay();
            this.onChange();
          });
        });
      }

      toggleDropdown() {
        // Close other dropdowns
        document.querySelectorAll('.custom-multiselect').forEach(ms => {
          if (ms !== this.element) {
            ms.classList.remove('open');
            ms.querySelector('.custom-multiselect-button')?.classList.remove('active');
            ms.querySelector('.custom-multiselect-dropdown')?.classList.remove('active');
          }
        });

        this.element.classList.toggle('open');
        this.button.classList.toggle('active');
        this.dropdown.classList.toggle('active');
      }

      closeDropdown() {
        this.element.classList.remove('open');
        this.button.classList.remove('active');
        this.dropdown.classList.remove('active');
      }

      updateDisplay() {
        const placeholder = this.element.querySelector('.custom-multiselect-placeholder');
        
        if (this.selectedValues.length === 0) {
          placeholder.style.display = 'inline';
          this.tagsContainer.innerHTML = '';
        } else {
          placeholder.style.display = 'none';
          this.tagsContainer.innerHTML = this.selectedValues.map(val => `
            <span class="custom-multiselect-tag">
              ${val}
              <span class="custom-multiselect-tag-remove" data-value="${val}">×</span>
            </span>
          `).join('');

          this.tagsContainer.querySelectorAll('.custom-multiselect-tag-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const value = e.target.getAttribute('data-value');
              this.selectedValues = this.selectedValues.filter(v => v !== value);
              this.updateDisplay();
              this.renderOptions(this.searchInput.value);
              this.onChange();
            });
          });
        }

        this.selectAllCheckbox.checked = this.selectedValues.length === this.options.length;
      }

      getSelectedValues() {
        return this.selectedValues;
      }

      onChange() {
        // Update the hidden select element
        const hiddenSelect = document.querySelector(`select[id="${this.element.id.replace('Multiselect', 'Dropdown')}"]`);
        if (hiddenSelect) {
          // Clear all selections first
          Array.from(hiddenSelect.options).forEach(opt => {
            opt.selected = false;
          });
          // Set new selections
          this.selectedValues.forEach(value => {
            const option = Array.from(hiddenSelect.options).find(opt => opt.value === value);
            if (option) {
              option.selected = true;
            }
          });
          // Dispatch change event that your choropleth scripts are listening for
          const changeEvent = new Event('change', { bubbles: true });
          hiddenSelect.dispatchEvent(changeEvent);
        }
        
        // Trigger custom event as well
        const event = new CustomEvent('multiselectchange', { 
          detail: { 
            values: this.selectedValues,
            elementId: this.element.id
          } 
        });
        this.element.dispatchEvent(event);
      }
    }


var style = document.createElement('style');
style.setAttribute("id", "multiselect_dropdown_styles");
style.innerHTML = `
.multiselect-dropdown{
  display: inline-block;
  padding: 2px 5px 0px 5px;
  border-radius: 4px;
  border: solid 1px #ced4da;
  background-color: white;
  position: relative;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23343a40' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M2 5l6 6 6-6'/%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right .75rem center;
  background-size: 16px 12px;
}
.multiselect-dropdown span.optext, .multiselect-dropdown span.placeholder{
  margin-right:0.5em; 
  margin-bottom:2px;
  padding:1px 0; 
  border-radius: 4px; 
  display:inline-block;
}
.multiselect-dropdown span.optext{
  background-color:lightgray;
  padding:1px 0.75em; 
}
.multiselect-dropdown span.optext .optdel {
  float: right;
  margin: 0 -6px 1px 5px;
  font-size: 0.7em;
  margin-top: 2px;
  cursor: pointer;
  color: #666;
}
.multiselect-dropdown span.optext .optdel:hover { color: #c66;}
.multiselect-dropdown span.placeholder{
  color:#ced4da;
}
.multiselect-dropdown-list-wrapper{
  box-shadow: gray 0 3px 8px;
  z-index: 100;
  padding:2px;
  border-radius: 4px;
  border: solid 1px #ced4da;
  display: none;
  margin: -1px;
  position: absolute;
  top:0;
  left: 0;
  right: 0;
  background: white;
}
.multiselect-dropdown-list-wrapper .multiselect-dropdown-search{
  margin-bottom:5px;
}
.multiselect-dropdown-list{
  padding:2px;
  height: 15rem;
  overflow-y:auto;
  overflow-x: hidden;
}
.multiselect-dropdown-list::-webkit-scrollbar {
  width: 6px;
}
.multiselect-dropdown-list::-webkit-scrollbar-thumb {
  background-color: #bec4ca;
  border-radius:3px;
}

.multiselect-dropdown-list div{
  padding: 5px;
}
.multiselect-dropdown-list input{
  height: 1.15em;
  width: 1.15em;
  margin-right: 0.35em;  
}
.multiselect-dropdown-list div.checked{
}
.multiselect-dropdown-list div:hover{
  background-color: #ced4da;
}
.multiselect-dropdown span.maxselected {width:100%;}
.multiselect-dropdown-all-selector {border-bottom:solid 1px #999;}
`;
document.head.appendChild(style);

function MultiselectDropdown(options) {
  var config = {
    search: true,
    height: '15rem',
    placeholder: 'select',
    txtSelected: 'selected',
    txtAll: 'All',
    txtRemove: 'Remove',
    txtSearch: 'search',
    ...options
  };

  function newEl(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs !== undefined) Object.keys(attrs).forEach(k => {
      if (k === 'class') {
        Array.isArray(attrs[k]) ? attrs[k].forEach(o => o !== '' ? e.classList.add(o) : 0) : (attrs[k] !== '' ? e.classList.add(attrs[k]) : 0)
      } else if (k === 'style') {
        Object.keys(attrs[k]).forEach(ks => {
          e.style[ks] = attrs[k][ks];
        });
      } else if (k === 'text') {
        attrs[k] === '' ? e.innerHTML = '&nbsp;' : e.innerText = attrs[k]
      } else e[k] = attrs[k];
    });
    return e;
  }


  document.querySelectorAll("select[multiple]").forEach((el, k) => {

    var div = newEl('div', {
      class: 'multiselect-dropdown',
      style: {
        width: config.style?.width ?? el.clientWidth + 'px',
        padding: config.style?.padding ?? ''
      }
    });
    el.style.display = 'none';
    el.parentNode.insertBefore(div, el.nextSibling);
    var listWrap = newEl('div', {
      class: 'multiselect-dropdown-list-wrapper'
    });
    var list = newEl('div', {
      class: 'multiselect-dropdown-list',
      style: {
        height: config.height
      }
    });
    var search = newEl('input', {
      class: ['multiselect-dropdown-search'].concat([config.searchInput?.class ?? 'form-control']),
      style: {
        width: '100%',
        display: el.attributes['multiselect-search']?.value === 'true' ? 'block' : 'none'
      },
      placeholder: config.txtSearch
    });
    listWrap.appendChild(search);
    div.appendChild(listWrap);
    listWrap.appendChild(list);

    el.loadOptions = () => {
      list.innerHTML = '';

      if (el.attributes['multiselect-select-all']?.value == 'true') {
        var op = newEl('div', {
          class: 'multiselect-dropdown-all-selector'
        })
        var ic = newEl('input', {
          type: 'checkbox'
        });
        op.appendChild(ic);
        op.appendChild(newEl('label', {
          text: config.txtAll
        }));

        op.addEventListener('click', () => {
          op.classList.toggle('checked');
          op.querySelector("input").checked = !op.querySelector("input").checked;

          var ch = op.querySelector("input").checked;
          list.querySelectorAll(":scope > div:not(.multiselect-dropdown-all-selector)")
            .forEach(i => {
              if (i.style.display !== 'none') {
                i.querySelector("input").checked = ch;
                i.optEl.selected = ch
              }
            });

          el.dispatchEvent(new Event('change'));
        });
        ic.addEventListener('click', (ev) => {
          ic.checked = !ic.checked;
        });
        el.addEventListener('change', (ev) => {
          let itms = Array.from(list.querySelectorAll(":scope > div:not(.multiselect-dropdown-all-selector)")).filter(e => e.style.display !== 'none')
          let existsNotSelected = itms.find(i => !i.querySelector("input").checked);
          if (ic.checked && existsNotSelected) ic.checked = false;
          else if (ic.checked == false && existsNotSelected === undefined) ic.checked = true;
        });

        list.appendChild(op);
      }

      Array.from(el.options).map(o => {
        var op = newEl('div', {
          class: o.selected ? 'checked' : '',
          optEl: o
        })
        var ic = newEl('input', {
          type: 'checkbox',
          checked: o.selected
        });
        op.appendChild(ic);
        op.appendChild(newEl('label', {
          text: o.text
        }));

        op.addEventListener('click', () => {
          op.classList.toggle('checked');
          op.querySelector("input").checked = !op.querySelector("input").checked;
          op.optEl.selected = !!!op.optEl.selected;
          el.dispatchEvent(new Event('change'));
        });
        ic.addEventListener('click', (ev) => {
          ic.checked = !ic.checked;
        });
        o.listitemEl = op;
        list.appendChild(op);
      });
      div.listEl = listWrap;

      div.refresh = () => {
        div.querySelectorAll('span.optext, span.placeholder').forEach(t => div.removeChild(t));
        var sels = Array.from(el.selectedOptions);
        if (sels.length > (el.attributes['multiselect-max-items']?.value ?? 5)) {
          div.appendChild(newEl('span', {
            class: ['optext', 'maxselected'],
            text: sels.length + ' ' + config.txtSelected
          }));
        } else {
          sels.map(x => {
            var c = newEl('span', {
              class: 'optext',
              text: x.text,
              srcOption: x
            });
            if ((el.attributes['multiselect-hide-x']?.value !== 'true'))
              c.appendChild(newEl('span', {
                class: 'optdel',
                text: '⨉',
                title: config.txtRemove,
                onclick: (ev) => {
                  c.srcOption.listitemEl.dispatchEvent(new Event('click'));
                  div.refresh();
                  ev.stopPropagation();
                }
              }));

            div.appendChild(c);
          });
        }
        if (0 == el.selectedOptions.length) div.appendChild(newEl('span', {
          class: 'placeholder',
          text: el.attributes['placeholder']?.value ?? config.placeholder
        }));
      };
      div.refresh();
    }
    el.loadOptions();

    search.addEventListener('input', () => {
      list.querySelectorAll(":scope div:not(.multiselect-dropdown-all-selector)").forEach(d => {
        var txt = d.querySelector("label").innerText.toUpperCase();
        d.style.display = txt.includes(search.value.toUpperCase()) ? 'block' : 'none';
      });
    });

    div.addEventListener('click', () => {
      div.listEl.style.display = 'block';
      search.focus();
      search.select();
    });

    document.addEventListener('click', function(event) {
      if (!div.contains(event.target)) {
        listWrap.style.display = 'none';
        div.refresh();
      }
    });
  });
}

window.addEventListener('load', () => {
  MultiselectDropdown(window.MultiselectDropdownOptions);
});