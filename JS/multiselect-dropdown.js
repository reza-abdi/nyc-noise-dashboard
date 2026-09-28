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
    }
