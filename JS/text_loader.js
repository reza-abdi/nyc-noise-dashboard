// text_loader.js
// Function to fetch content from a .txt file and populate a target element
function loadTextContent(filePath, targetElementId) {
    fetch(filePath)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok, status: ' + response.status);
            }
            return response.text();
        })
        .then(text => {
            const targetDiv = document.getElementById(targetElementId);
            if (targetDiv) {
                // 1. Replace double newlines (\n\n) with paragraph breaks </p><p>
                let formattedText = text.replace(/(\n\n)/g, '</p><p>');
                
                // 2. Wrap the text in an initial and final paragraph tag
                formattedText = '<p>' + formattedText + '</p>';
                
                // 3. Optional: Replace any remaining single newlines (\n) with <br> for line breaks
                formattedText = formattedText.replace(/(\n)/g, '<br>');

                targetDiv.innerHTML = formattedText; 
            }
        })
        .catch(error => {
            console.error(`Error fetching ${filePath}:`, error);
            const targetDiv = document.getElementById(targetElementId);
            if (targetDiv) {
                targetDiv.innerHTML = `<p style="color: red;">Error loading content from ${filePath}.</p>`;
            }
        });
}

// When the DOM is fully loaded, execute the functions to load the text files
document.addEventListener('DOMContentLoaded', () => {
    // This loads the historical overview text
    loadTextContent('data/overview.txt', 'overview-text');
    // This loads the predictive model methods text
    loadTextContent('data/methods.txt', 'model-details-text');
});