window.addEventListener('DOMContentLoaded', () => {
    const dropArea = document.getElementById('drop-area');
    const fileElem = document.getElementById('fileElem');
    const fileListDiv = dropArea.querySelector('.file-list');
    const exportCsvBtn = document.getElementById('export-csv');
    const uploadBtn = document.getElementById('upload-btn');
    let filesToUpload = [];

    // Drag & Drop handlers
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.classList.add('dragover');
    });

    dropArea.addEventListener('dragleave', () => {
        dropArea.classList.remove('dragover');
    });

    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.classList.remove('dragover');
        console.log("Files dropped:", e.dataTransfer.files);
        handleFiles(e.dataTransfer.files);
    });

    // Click-to-select handler
    fileElem.addEventListener('change', (e) => {
        console.log("Files selected:", e.target.files);
        handleFiles(e.target.files);
    });

    // Browse button triggers file input
    dropArea.querySelector('button').addEventListener('click', () => {
        fileElem.value = ''; // Reset so same file can be selected again
        fileElem.click();
    });

    // Handle files (from drop or file input)
    function handleFiles(fileList) {
        const files = Array.from(fileList);
        files.forEach(file => {
            if (!filesToUpload.some(f => f.name === file.name && f.size === file.size)) {
                filesToUpload.push(file);
                displayFile(file);
            }
        });
    }

    // Display file in the UI
    function displayFile(file) {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.textContent = file.name;
        fileListDiv.appendChild(div);
    }

    // Upload files to backend
    async function uploadFiles() {
        if (filesToUpload.length === 0) {
            alert("Please select or drop files to upload.");
            return;
        }
        for (const file of filesToUpload) {
            const formData = new FormData();
            formData.append('replay', file);
            try {
                const response = await fetch('http://localhost:8080/upload', {
                    method: 'POST',
                    body: formData
                });
                if (!response.ok) throw new Error(`Failed to upload ${file.name}`);
            } catch (err) {
                alert(`Error uploading ${file.name}: ${err.message}`);
            }
        }
        alert("All files uploaded successfully!");
        filesToUpload = [];
        fileListDiv.innerHTML = '';
    }

    // Add upload on double-click or Enter on drop area
    uploadBtn.addEventListener('click', uploadFiles);

    // CSV Export handler
    exportCsvBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('http://localhost:8080/export-csv', {
                method: 'GET'
            });
            if (!response.ok) throw new Error('Failed to export CSV');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'player_statistics.csv';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            alert('CSV export failed: ' + err.message);
        }
    });
});