// Listen for keyboard shortcuts to navigate Google results
document.addEventListener('keydown', (event) => {
  // Check for Alt/Option + Arrow keys
  if (event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
    if (event.key === 'ArrowRight') {
      // Navigate to next page
      const nextButton = document.getElementById('pnnext');
      if (nextButton) {
        event.preventDefault();
        nextButton.click();
      }
    } else if (event.key === 'ArrowLeft') {
      // Navigate to previous page
      const prevButton = document.getElementById('pnprev');
      if (prevButton) {
        event.preventDefault();
        prevButton.click();
      }
    }
  }
});
