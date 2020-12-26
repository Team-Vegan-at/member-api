
function fetchPayments(data) {
  // var $table = $('#payments-table')
  let baseUrl = 'http://localhost:3000/membership/payments'
  let searchParams = new URLSearchParams(window.location.search)
  searchParams.has('user') // true
  let idHash = searchParams.get('user')

  $.ajax({
    url: baseUrl,
    data: {
      // email: 'geahaad+201@gmail.com'
      email: idHash
    }
  }).done(function(payments) {
    console.log(payments);
    data.success(payments);
  }).fail(function(reason) {
    console.error(reason.statusText);
    data.error(reason.statusText)
  });
}

function loadingTemplate(message) {
    return '<div class="ph-item"><div class="ph-picture"></div></div>'
}
