document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const uploadSection = document.getElementById('upload-section');
    const loadingState = document.getElementById('loading-state');
    const loadingText = document.getElementById('loading-text');
    const resultsSection = document.getElementById('results-section');
    const summaryContent = document.getElementById('summary-content');
    const resetBtn = document.getElementById('reset-btn');

    // Currently local, will be updated when AWS SAM is deployed
    const API_ENDPOINT = 'https://22fs7zd1ki.execute-api.us-east-1.amazonaws.com/Prod/summarize';

    // Handle drag and drop events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('dragover');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) handleFile(files[0]);
    });

    fileInput.addEventListener('change', function () {
        if (this.files.length > 0) handleFile(this.files[0]);
    });

    function handleFile(file) {
        if (file.type !== 'application/pdf') {
            alert('Please upload a valid Resume (PDF file).');
            return;
        }

        // UI State transition
        uploadSection.classList.add('hidden');
        loadingState.classList.remove('hidden');
        loadingText.textContent = 'Extracting text from Resume (Local)...';

        extractTextFromPdf(file);
    }

    async function extractTextFromPdf(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            let fullText = '';

            // Iterate through every page
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + '\n';
            }

            console.log("Extracted text length:", fullText.length);

            // Limit text if it's monstrously huge (e.g. 50,000 characters) to save token limits
            const maxChars = 50000;
            if (fullText.length > maxChars) {
                fullText = fullText.substring(0, maxChars) + '... [TRUNCATED]';
                console.warn('Resume text truncated to save token costs.');
            }

            // Next step: send to AWS API Gateway
            sendToBackend(fullText);

        } catch (error) {
            console.error('Error parsing PDF:', error);
            alert('Failed to parse the Resume. Ensure it isn\'t corrupted or password protected.');
            resetUI();
        }
    }

    async function sendToBackend(text) {
        loadingText.textContent = 'Generating summary with Amazon Nova Micro...';

        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: text })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            displayResults(data.bullets || []);

        } catch (error) {
            console.error('Error fetching summary:', error);
            alert('Error communicating with the backend summarization service. Is the backend running?');
            resetUI();
        }
    }

    function displayResults(bullets) {
        loadingState.classList.add('hidden');
        resultsSection.classList.remove('hidden');

        summaryContent.innerHTML = '';

        if (bullets.length === 0) {
            summaryContent.innerHTML = '<p>No summary could be generated.</p>';
            return;
        }

        const ul = document.createElement('ul');
        bullets.forEach(bullet => {
            const li = document.createElement('li');
            li.textContent = bullet;
            ul.appendChild(li);
        });

        summaryContent.appendChild(ul);
    }

    function resetUI() {
        uploadSection.classList.remove('hidden');
        loadingState.classList.add('hidden');
        resultsSection.classList.add('hidden');
        fileInput.value = '';
    }

    resetBtn.addEventListener('click', resetUI);
});
