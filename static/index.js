window.addEventListener('load', init);
console.log("1");
function init(){
    console.log("init");
    let uploadbtn = document.getElementById('uploadForm');
    console.log(uploadbtn);

    uploadbtn.addEventListener('submit',uploadfile);
}

async function uploadfile(event){
    event.preventDefault();
    const URL = "http://localhost:8080";
    const fileInput = document.getElementById('fileInput');
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
