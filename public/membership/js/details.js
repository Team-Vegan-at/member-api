/*** INIT ***/
let searchParams = new URLSearchParams(window.location.search);
let pat;
let email;
let activeSubscription = false;

if (!searchParams.has('pat')) {
  console.error('PAT not found');
  // TODO Error on site
} else {
  pat = searchParams.get('pat')
}

// Fetch user Profile
$('#loading').modal('show');
fetchProfile(function(profile) {
  $('#profileName').text(profile.name);

  if (profile.membershipValid) {
    $('#membershipValid').text(`gültig bis ${dateFormatter(profile.membershipValidTo)}`);
  } else {
    $('#membershipNotValid').text('leider abgelaufen');
  }

  email = profile.email;

  // Pre-fill e-mail field
  $('input[name="email"]').val(profile.email);

  $('#loading').modal('hide');
});

/*** FUNCTIONS ***/
function fetchProfile(callback) {
  let url = `${baseUrl}/membership/profile`;

  $.ajax({
    url,
    crossDomain: true,
    headers: {
      'x-pat': pat
    }
  }).done(function (profile) {
    callback(profile);
  }).fail(function (reason) {
    $('#alert-modal').modal('show');
    $('#alert-details').text(reason.responseText);
    console.error(reason.responseText);

    callback(reason);
  });
}

function fetchPayments(data) {
  let url = `${baseUrl}/membership/payments`;

  $.ajax({
    url,
    crossDomain: true,
    headers: {
      'x-pat': pat
    }
  }).done(function (payments) {
    data.success(payments);
  }).fail(function (reason) {
    $('#alert-modal').modal('show');
    $('#alert-details').text(reason.responseText);
    console.error(reason.responseText);

    data.error(reason.responseText)
  });
}

function fetchSubscriptions(data) {
  let url = `${baseUrl}/membership/subscriptions`;

  $.ajax({
    url,
    crossDomain: true,
    headers: {
      'x-pat': pat
    }
  }).done(function (subscriptions) {
    if (!subscriptions) {
      activeSubscription = false;
      $('#subscriptions-table').addClass('d-none').removeClass('d-block');
      $('#create-new-subscription-section').addClass('d-block').removeClass('d-none');
      data.error();
    } else {
      let subRes = [];
      subRes.push(subscriptions);
      activeSubscription = true;
      $('#subscriptions-table').addClass('d-block').removeClass('d-none');
      $('#create-new-subscription-section').addClass('d-none').removeClass('d-block');
      data.success(subRes);
    }
  }).fail(function (reason) {
    activeSubscription = false;
    $('#subscriptions-table').addClass('d-none').removeClass('d-block');
    $('#create-new-subscription-section').addClass('d-block').removeClass('d-none');

    $('#alert-modal').modal('show');
    $('#alert-details').text(reason.responseText);
    console.error(reason.responseText);
    data.error(reason.responseText)
  });
}

function cancelSubscription(callback) {
  let url = `${baseUrl}/membership/subscriptions`;

  $.ajax({
    url: `${url}`,
    crossDomain: true,
    method: "DELETE",
    headers: {
      'x-pat': pat
    }
  }).done(function () {
    if (callback) {
      callback();
    }
  }).fail(function (reason) {
    $('#alert-modal').modal('show');
    $('#alert-details').text(reason.responseText);
    console.error(reason.responseText);
    callback();
  });
}

function onceOffPayment(callback) {
  let url = `${baseUrl}/membership/onceoffpayment`;

  $.ajax({
    url,
    crossDomain: true,
    data: {
      redirectUrl: window.location.href
    },
    headers: {
      'x-pat': pat
    }
  }).done(async function (checkoutURL) {
    if (activeSubscription) {
      $('#onceoff-payment-warning').addClass('d-inline').removeClass('d-none');
      $('#onceoff-payment-text').addClass('d-none').removeClass('d-inline');
      $('#confirm-mollie-redirect').prop('disabled', true);
    } else {
      $('#onceoff-payment-warning').addClass('d-none').removeClass('d-inline');
      $('#onceoff-payment-text').addClass('d-inline').removeClass('d-none');

      $('#loading-payment-link').toggleClass(['d-none', 'd-inline']);
      $('#payment-link').toggleClass(['d-none', 'd-inline']);
      $('#confirm-mollie-redirect').prop('disabled', false);

      $('#confirm-mollie-redirect').on('click', function() {
        window.location.replace(checkoutURL);
      });
    }
  }).fail(function (reason) {
    $('#onceoff-payment-modal').modal('hide');
    $('#alert-modal').modal('show');
    $('#alert-details').text(reason.responseText);
    console.error(reason.responseText);
  });
}

function createSepaDD(callback) {
  let url = `${baseUrl}/membership/mandate`;
  let d = new Date();

  let formattedDate =
    d.getFullYear()
    + '-' + ('0' + (d.getMonth() + 1)).slice(-2)
    + '-' + ('0' + d.getDate()).slice(-2);

  // Step 1: Create Mandate
  $.ajax({
    url: `${url}`,
    crossDomain: true,
    method: "POST",
    contentType: "application/json",
    data: JSON.stringify({
      "name": $('input[name="name"]').val(),
      "account": $('input[name="iban"]').val().replace(/ /g,''),
      "signDate": formattedDate,
      "mandateRef": "TEAMVEGAN-" + Math.floor(100000 + Math.random() * 900000)
    }),
    headers: {
      'x-pat': pat
    }
  }).done(function () {
    console.info("Mandate created successfully");
    // Step 2: Create Subscription
    url = `${baseUrl}/membership/subscription`;
    $.ajax({
      url: `${url}`,
      crossDomain: true,
      method: "POST",
      headers: {
        'x-pat': pat
      }
    }).done(function () {
      console.info("Subscription created successfully");
      if (callback) {
        callback();
      }
    }).fail(function (reason) {
      $('#alert-modal').modal('show');
      $('#alert-details').text(reason.responseText);
      console.error(reason.responseText);

      if (callback) {
        callback();
      }
    });
  }).fail(function (reason) {
    $('#alert-modal').modal('show');
    $('#alert-details').text(reason.responseText);
    console.error(reason.responseText);

    if (callback) {
      callback();
    }
  });
}

function operateFormatter(value, row, index) {
  return [
    '<a class="remove btn btn-danger" href="javascript:void(0)" title="Remove">',
    'Dauerauftrag k&uuml;ndigen',
    '</a>'
  ].join('')
}

window.subscriptionEvents = {
  'click .remove': function (e, value, row, index) {
    $('#loading').modal('show');

    cancelSubscription(function() {
      $('#loading').modal('hide');
      $('#subscriptions-table').bootstrapTable('refresh');
    });
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
    return 'Wir haben keine Zahlungen gefunden';
  }
});

$('#confirm-subscription').on('click', function() {
  $('#loading').modal('show');

  createSepaDD(function() {
    $('#loading').modal('hide');
    $('#collapseSepaDD').collapse("hide");
    $('#subscriptions-table').bootstrapTable('refresh');
  });
});

$('#onceoff-payment').on('click', function() {
  $('#onceoff-payment-modal').modal('show');

  onceOffPayment(function() {
    // no action
  });
});

$('input[name="iban"]').focusout(function() {
  if (IBAN.isValid($('input[name="iban"]').val())) {
    $('input[name="iban"]').addClass('is-valid').removeClass('is-invalid');
    $('#iban-invalid-feedback').addClass('d-none').removeClass('d-inline');

    if (isSepaDDFormValid()) {
      $('#confirm-subscription').prop('disabled', false);
    } else {
      $('#confirm-subscription').prop('disabled', true);
    }
  } else {
    $('input[name="iban"]').addClass('is-invalid');
    $('#iban-invalid-feedback').addClass('d-inline').removeClass('d-none');
    $('#confirm-subscription').prop('disabled', true);
  }
});

$('input[name="name"]').focusout(function() {
  if ($('input[name="name"]').val().length > 0) {
    $('input[name="name"]').addClass('is-valid').removeClass('is-invalid');

    if (isSepaDDFormValid()) {
      $('#confirm-subscription').prop('disabled', false);
    } else {
      $('#confirm-subscription').prop('disabled', true);
    }
  } else {
    $('input[name="name"]').addClass('is-invalid');
    $('#confirm-subscription').prop('disabled', true);
  }
});

/** FORMATTERS */
function dateFormatter(value) {
  if (!value) {
    return '-';
  }
  return value.substring(0, 10);
}

function priceFormatter(value) {
  if (!value) {
    return '-';
  }
  return `&euro; ${value.substring(0, 2)},-`;
}

function methodFormatter(value) {
  if (value === "creditcard") {
    return "Kreditkarte";
  } else if (value === "eps") {
    return "EPS";
  } else if (value === "directdebit") {
    return "Dauerauftrag";
  } else if (value === "banktransfer") {
    return "&Uuml;berweisung";
  } else {
    return value;
  }
}

function statusFormatter(value) {
  if (value === "paid") {
    return "Bezahlt";
  } else if (value === "pending" || value === "open") {
    return "In Bearbeitung";
  } else if (value === "rejected") {
    return "Abgelehnt";
  } else {
    return value;
  }
}

/** HELPER */
function isSepaDDFormValid() {
  return IBAN.isValid($('input[name="iban"]').val())
    && $('input[name="email"]').val().length > 0
    && $('input[name="name"]').val().length > 0;
}
