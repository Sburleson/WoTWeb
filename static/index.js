window.addEventListener('load', init);
console.log("1");
function init(){
    console.log("init");
    let uploadbtn = document.getElementById('dropZone');
    console.log(uploadbtn);
    uploadbtn.addEventListener('submit',uploadfile);

    const fileList = document.getElementById('fileList');

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');

        fileList.innerHTML = ''; // Clear previous items

        if (e.dataTransfer.items) {
            for (let i = 0; i < e.dataTransfer.items.length; i++) {
                const item = e.dataTransfer.items[i].webkitGetAsEntry();
                displayItem(item.name);
                traverseFileTree(item);
            }
        }
    });
}


async function HandelFiles(file){
    const URL = "http://localhost:8080";
    const formData = new FormData();
    formData.append('replay',file);
    const response = await fetch(URL+'/upload', {
        method: 'POST',
        body: formData,
    })

    .then((response) => {
        console.log(response);
    })
    .catch((error) => {
        console.error(error);
    });
}

function traverseFileTree(item, path = '') {
    if (item.isFile) {
        item.file(file => {
            HandelFiles(file);
        });
    } else if (item.isDirectory) {
        const dirReader = item.createReader();
        dirReader.readEntries(entries => {
            for (let i = 0; i < entries.length; i++) {
                traverseFileTree(entries[i], path + item.name + '/');
            }
        });
    }
}

function displayItem(fileName) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.textContent = fileName;
    fileList.appendChild(fileItem);
}

async function uploadfile(event){
    event.preventDefault();
    const URL = "http://localhost:8080";
    const fileInput = document.getElementById('dropZone');
    const formData = new FormData();
    console.log("fileinput",fileInput.files[0]);
    formData.append('replay', fileInput.files[0]);
    console.log("upload button press");
    console.log(formData);
    const response = await fetch(URL+'/upload', {
        method: 'POST',
        body: formData,
    })

    .then((response) => {
        console.log(response);
    })
    .catch((error) => {
        console.error(error);
    });
}
