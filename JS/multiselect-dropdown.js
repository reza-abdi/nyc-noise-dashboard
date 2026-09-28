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
