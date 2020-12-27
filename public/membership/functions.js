/*** INIT ***/
let baseUrl = 'http://localhost:3000';
let searchParams = new URLSearchParams(window.location.search);
let idHash;
if (!searchParams.has('user')) {
  console.error('User not found');
  // TODO Error on site
} else {
  idHash = searchParams.get('user')
}

// Pre-fill e-mail field
$('input[name="email"]').val(idHash);

/*** FUNCTIONS ***/
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
  }).done(function (payments) {
    data.success(payments);
  }).fail(function (reason) {
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
  }).done(function (subscriptions) {
    if (!subscriptions) {
      data.error();
    } else {
      let subRes = [];
      subRes.push(subscriptions)
      data.success(subRes);
    }
  }).fail(function (reason) {
    console.error(reason.statusText);
    data.error(reason.statusText)
  });
}

function cancelSubscription(callback) {
  let url = `${baseUrl}/membership/subscriptions`;
  let searchParams = new URLSearchParams(window.location.search)
  if (!searchParams.has('user')) {
    data.error('User not found');
  }
  let idHash = searchParams.get('user')

  $.ajax({
    url: `${url}?${$.param({
        "email": idHash
      })}`,
    method: "DELETE"
  }).done(function () {
    if (callback) {
      callback();
    }
  }).fail(function (reason) {
    console.error(reason.statusText);
  });
}

function createSepaDD(callback) {
  let url = `${baseUrl}/membership/mandate`;
  let d = new Date();
  let formattedDate = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();

  // Step 1: Create Mandate
  $.ajax({
    url: `${url}?${$.param({
        "email": idHash
      })}`,
    method: "POST",
    contentType: "application/json",
    data: JSON.stringify({
      "name": $('input[name="name"]').val(),
      "account": $('input[name="iban"]').val(),
      "signDate": formattedDate,
      "mandateRef": "TEAMVEGAN-" + Math.floor(100000 + Math.random() * 900000)
    })
  }).done(function () {
    console.info("Mandate created successfully");
    // Step 2: Create Subscription
    url = `${baseUrl}/membership/subscription`;
    $.ajax({
      url: `${url}?${$.param({
          "email": idHash
        })}`,
      method: "POST",
    }).done(function () {
      console.info("Subscription created successfully");
      if (callback) {
        callback();
      }
    }).fail(function (reason) {
      console.error(reason.statusText);
      if (callback) {
        callback();
      }
    });
  }).fail(function (reason) {
    console.error(reason.statusText);
    if (callback) {
      callback();
    }
  });
}

function operateFormatter(value, row, index) {
  return [
    '<a class="remove btn btn-danger" href="javascript:void(0)" title="Remove">',
    'Dauerauftrag kündigen',
    '</a>'
  ].join('')
}

window.subscriptionEvents = {
  'click .remove': function (e, value, row, index) {
    // cancelSubscription().done(function() {
    //   $('#subscriptions-table').bootstrapTable('refresh');
    cancelSubscription(function() {
      $('#subscriptions-table').bootstrapTable('refresh');
    });
    // }).fail(function() {
    //   $('#subscriptions-table').bootstrapTable('refresh');
    // });
  }
}

function loadingTemplate(message) {
  return '<div class="ph-item"><div class="ph-picture"></div></div>'
}

/*** EVENTS  ***/
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

$('#confirm-subscription').on('click', function() {
  $('#loading').modal('show');

  createSepaDD(function() {
    $('#loading').modal('hide');
  });
});

