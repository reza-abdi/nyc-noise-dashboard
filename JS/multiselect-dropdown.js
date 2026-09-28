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
