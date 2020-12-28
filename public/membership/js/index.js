/*** EVENTS  ***/
$('#confirm-login').on('click', function() {
  $('#confirm-login').prop('disabled', true);

  window.location.replace(`details.html?user=${$('input[id="email"]').val()}`);
});
