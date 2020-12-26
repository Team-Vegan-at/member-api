let baseUrl = 'http://localhost:3000/';

function fetchPayments(data) {
  let url = `${baseUrl}/membership/payments`;
  let searchParams = new URLSearchParams(window.location.search)
  if (!searchParams.has('user')) {
    data.error('User not found');
  }
  let idHash = searchParams.get('user')

  $.ajax({
    url,
    data: {
      email: idHash
    }
  }).done(function(payments) {
    data.success(payments);
  }).fail(function(reason) {
    console.error(reason.statusText);
    data.error(reason.statusText)
  });
}

function fetchSubscriptions(data) {
  let url = `${baseUrl}/membership/subscriptions`;
  let searchParams = new URLSearchParams(window.location.search)
  if (!searchParams.has('user')) {
    data.error('User not found');
  }
  let idHash = searchParams.get('user')

  $.ajax({
    url,
    data: {
      email: idHash
    }
  }).done(function(subscriptions) {
    if (!subscriptions) {
      data.error();
    } else {
      let subRes = [];
      subRes.push(subscriptions)
      data.success(subRes);
    }
  }).fail(function(reason) {
    console.error(reason.statusText);
    data.error(reason.statusText)
  });
}

function loadingTemplate(message) {
    return '<div class="ph-item"><div class="ph-picture"></div></div>'
}

$('#subscriptions-table').bootstrapTable({
  formatNoMatches: function () {
      return 'Wir haben keinen Dauerauftrag gefunden';
  }
});

$('#payments-table').bootstrapTable({
  formatNoMatches: function () {
      return 'Wir haben keine Zahlungen gefundenn';
  }
});
