
window.addEventListener('load', init);

function init() {
  console.log("init");
  let sortfield = document.getElementById('sort-by');
  console.log(sortfield);

  let search = document.getElementById('search');

  sortfield.addEventListener('change', searchName);
  search.addEventListener('input', searchName);
  fetchStats(); // Initial fetch to populate the table
}

function searchName(){
  let name = document.getElementById('search').value;
  let sortBy = document.getElementById('sort-by').value;
  if(name == ''){
    fetchStats();
  }
  else{
  console.log(name);
  const URL = "http://localhost:8080";
  fetch(URL + `/test?sort_by=${sortBy}&name=${name}`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      console.log(data);
      //populateSearch(data);
      populatetable(data);
    })
    .catch(error => console.error('Error fetching data:', error));
  }
}

function fetchStats() {
  const sortBy = document.getElementById('sort-by').value;
  const URL = "http://localhost:8080";
  fetch(URL + `/stats?sort_by=${sortBy}`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      console.log(data);
      populatetable(data);
    })
    .catch(error => console.error('Error fetching data:', error));
}

function populatetable(data) {
  console.log("poptable data:", data);
  const tableBody = document.getElementById('stats-table');
  tableBody.innerHTML = '';
  data.forEach(player => {
    const row = document.createElement('tr');
    Object.values(player).slice(1).forEach(value => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.appendChild(cell);
    });
    tableBody.appendChild(row);
  });
}

function populateSearch(data){
  console.log("popsearch data:", data);
  const searchBody = document.getElementById('SearchResults');
  searchBody.innerHTML = '';
  data.forEach(player => {
    const row = document.createElement('option');
    row.textContent = Object.values(player)[1];
    console.log("Sname",Object.values(player)[1]);
    searchBody.appendChild(row);
  });
}
