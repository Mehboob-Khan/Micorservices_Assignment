document.addEventListener('DOMContentLoaded', function() {
  loadJokeTypes();
  pollForNewJokes(); // Poll for new jokes instead of loading just once

  document.getElementById('submitJoke').addEventListener('click', function() {
    submitJoke();
    // No need to reload types after each operation; assuming types don't change often
  });
  
  document.getElementById('deleteJoke').addEventListener('click', function() {
    deleteJoke();
    // No need to reload types after each operation
  });
});

function loadJokeTypes() {
  fetch('/types')
    .then(handleResponse)
    .then(types => {
      const select = document.getElementById('jokeType');
      select.innerHTML = ''; // Clear existing options
      types.forEach(typeObj => {
        const option = document.createElement('option');
        option.value = typeObj.type;
        option.textContent = typeObj.type;
        select.appendChild(option);
      });
    })
    .catch(error => {
      console.error('Error loading joke types:', error);
      updateMessage('Error loading joke types. Please try again later.');
    });
}

function pollForNewJokes() {
  function fetchNewJoke() {
    fetch('/mod')
      .then(handleResponse)
      .then(joke => {
        if (joke && joke.setup) { // If there's a joke, display it
          displayJoke(joke);
        } else {
          updateMessage('No joke available for moderation. Waiting for new jokes...');
          setTimeout(fetchNewJoke, 5000); // Poll every 5 seconds if no joke is available
        }
      })
      .catch(error => {
        console.error('Network error:', error);
        updateMessage('Network error. Please check the connection to the server.');
      });
  }
  fetchNewJoke(); // Initial call to start the process
}

function displayJoke(joke) {
  document.getElementById('setup').value = joke.setup || '';
  document.getElementById('punchline').value = joke.punchline || '';
  document.getElementById('jokeType').value = joke.type || '';
  window.currentJokeType = joke.type; // Keep track of the current joke's type
  updateMessage(''); // Clear any messages when displaying a new joke
}

function submitJoke() {
  const joke = {
    setup: document.getElementById('setup').value,
    punchline: document.getElementById('punchline').value,
    type: document.getElementById('jokeType').value
  };

  fetch('/mod', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(joke),
  })
  .then(handleResponse)
  .then(() => {
    alert('Joke submitted successfully.');
    pollForNewJokes(); // Immediately check for another joke to moderate
  })
  .catch(error => {
    console.error('Error submitting joke:', error);
    updateMessage('Error submitting joke. Please try again.');
  });
}

function deleteJoke() {
  fetch('/mod', {
    method: 'DELETE',
  })
  .then(handleResponse)
  .then(() => {
    alert('Joke deleted successfully.');
    pollForNewJokes(); // Immediately check for another joke to moderate
  })
  .catch(error => {
    console.error('Error deleting joke:', error);
    updateMessage('Error deleting joke. Please try again.');
  });
}

function handleResponse(response) {
  if (!response.ok) {
    response.json().then(err => {
      throw new Error(err.message || 'Network response was not ok.');
    });
  }
  return response.json();
}

function updateMessage(msg) {
  const messageElement = document.getElementById('message');
  messageElement.textContent = msg;
}
