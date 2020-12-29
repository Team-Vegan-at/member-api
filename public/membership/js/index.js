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
      // TODO: Info to user
    }).fail(function (reason) {
      // TODO: Info to user
    });

  // window.location.replace(`details.html?user=${$('input[id="email"]').val()}`);
});
