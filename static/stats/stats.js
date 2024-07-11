
window.addEventListener('load', init);
function init(){
    console.log("init");
    let sortfield = document.getElementById('sort-by');
    console.log(sortfield);

    sortfield.addEventListener('change',fetchStats);
}

function fetchStats() {
    const sortBy = document.getElementById('sort-by').value;
    // refer to other project, data not coming through
    const URL = "http://localhost:8080";
    fetch(URL+`/stats?sort_by=${sortBy}`)
        .then(response =>{
            if (!response.ok) {
                throw new Error('Network response was not ok');
              }
            return response.json();
        })
        .then(data =>{
            console.log(data);
            populatetable(data);
        });
}

async function populatetable(data){
    const tableBody = document.getElementById('stats-table');
    tableBody.innerHTML = '';
    console.log("t",data[0]);
    console.log("t2",data[0].name);
    for(player in data){
        stats = data[player];
        const row = document.createElement('tr');
        for(value in stats){
            console.log(stats[value]);
            const cell = document.createElement('td');
            cell.textContent = stats[value];
            row.appendChild(cell);
        }
        tableBody.appendChild(row);
    }
}
// Fetch initial data
//fetchStats();