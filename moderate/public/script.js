document.addEventListener('DOMContentLoaded', function() {
    // Load joke types and current joke for moderation
    loadJokeTypes();
    loadCurrentJoke();
  
    // Submit joke handler
    document.getElementById('submitJoke').addEventListener('click', submitJoke);
  
    // Delete joke handler
    document.getElementById('deleteJoke').addEventListener('click', deleteJoke);
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
  
  function loadCurrentJoke() {
    fetch('/moderate/mod')
      .then(response => {
        if (!response.ok) {
          throw new Error('No joke available for moderation');
        }
        return response.json();
      })
      .then(joke => {
        document.getElementById('setup').value = joke.setup;
        document.getElementById('punchline').value = joke.punchline;
        document.getElementById('jokeType').value = joke.type;
      })
      .catch(error => {
        console.error(error);
        setTimeout(loadCurrentJoke, 5000); // Poll every 5 seconds
      });
  }
  
  function submitJoke() {
    const joke = {
      setup: document.getElementById('setup').value,
      punchline: document.getElementById('punchline').value,
      type: document.getElementById('jokeType').value
    };
  
    fetch('/moderate/mod', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(joke),
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Problem submitting joke');
      }
      return response.json();
    })
    .then(() => {
      alert('Joke submitted successfully.');
      loadCurrentJoke(); // Load the next joke
    })
    .catch(error => {
      console.error('Error submitting joke:', error);
    });
  }
  
  function deleteJoke() {
    fetch('/moderate/mod', {
      method: 'DELETE',
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Problem deleting joke');
      }
      return response.json();
    })
    .then(() => {
      alert('Joke deleted successfully.');
      loadCurrentJoke(); // Load the next joke
    })
    .catch(error => {
      console.error('Error deleting joke:', error);
    });
  }
  