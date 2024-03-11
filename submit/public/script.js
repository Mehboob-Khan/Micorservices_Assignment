document.addEventListener('DOMContentLoaded', function() {
    // Fetch and populate types
    loadJokeTypes();
  
    const form = document.getElementById('jokeForm');
    form.onsubmit = function(event) {
      event.preventDefault();
      submitJoke();
    };
  });
  
  function loadJokeTypes() {
    fetch('/types')
      .then(response => response.json())
      .then(types => {
        const select = document.getElementById('jokeType');
        select.innerHTML = ''; 
        types.forEach(typeObj => {
          const option = document.createElement('option');
          option.value = typeObj.type; 
          option.textContent = typeObj.type;
          select.appendChild(option);
        });
      })
      .catch(error => console.error('Error loading joke types:', error));
  }
  
  
  function submitJoke() {
    const joke = {
      type: document.getElementById('jokeType').value,
      setup: document.getElementById('setup').value,
      punchline: document.getElementById('punchline').value
    };
  
    fetch('/sub', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(joke),
    })
    .then(response => response.json())
    .then(data => {
      alert(data.message); // Show a success message
    })
    .catch((error) => {
      console.error('Error:', error);
      alert('An error occurred while submitting the joke.');
    });
  }
  