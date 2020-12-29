
/*** EVENTS  ***/
$('#confirm-login').on('click', function() {
  $('#confirm-login').prop('disabled', true);

  email = $('input[name="email"]').val();

  url = `${baseUrl}/membership/login`;
  $.ajax({
    url: `${url}?email=${email}`,
    crossDomain: true,
    method: "POST"
  }).done(function () {
      $('#email-success-modal').modal('show');
      $('input[name="email"]').val('');
      $('#confirm-login').prop('disabled', false);
    }).fail(function (reason) {
      $('#email-failure-modal').modal('show');
      $('input[name="email"]').val('');
      $('#confirm-login').prop('disabled', false);
    });
});
