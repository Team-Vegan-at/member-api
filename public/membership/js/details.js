/*** INIT ***/
const authUrl = baseUrl + '/auth/otp';
let searchParams = new URLSearchParams(window.location.search);
let idHash;
let email;
let activeSubscription = false;

if (!searchParams.has('user')) {
  console.error('User not found');
  // TODO Error on site
} else {
  idHash = searchParams.get('user')
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
function fetchOTP(callback) {
  $.ajax({
    url: authUrl,
    crossDomain: true,
    headers: {
      'x-api-key': apiKey
    }
  }).done(function (otp) {
    callback(otp);
  }).fail(function (reason) {
    callback(reason.statusText);
  });
}

function fetchProfile(callback) {
  let url = `${baseUrl}/membership/profile`;

  fetchOTP(function(otp) {
    $.ajax({
      url,
      crossDomain: true,
      data: {
        email: idHash
      },
      headers: {
        Authorization: `Bearer ${otp}`
      }
    }).done(function (profile) {
      callback(profile);
    }).fail(function (reason) {
      console.error(reason.statusText);
      callback(reason);
    });
  })
}

function fetchPayments(data) {
  let url = `${baseUrl}/membership/payments`;

  fetchOTP(function(otp) {
    $.ajax({
      url,
      crossDomain: true,
      data: {
        email: idHash
      },
      headers: {
        Authorization: `Bearer ${otp}`
      }
    }).done(function (payments) {
      data.success(payments);
    }).fail(function (reason) {
      console.error(reason.statusText);
      data.error(reason.statusText)
    });
  })
}

function fetchSubscriptions(data) {
  let url = `${baseUrl}/membership/subscriptions`;

  fetchOTP(function(otp) {
    $.ajax({
      url,
      crossDomain: true,
      data: {
        email: idHash
      },
      headers: {
        Authorization: `Bearer ${otp}`
      }
    }).done(function (subscriptions) {
      if (!subscriptions) {
        activeSubscription = false;
        data.error();
      } else {
        let subRes = [];
        subRes.push(subscriptions);
        activeSubscription = true;
        data.success(subRes);
      }
    }).fail(function (reason) {
      activeSubscription = false;
      console.error(reason.statusText);
      data.error(reason.statusText)
    });
  });
}

function cancelSubscription(callback) {
  let url = `${baseUrl}/membership/subscriptions`;

  fetchOTP(function(otp) {
    $.ajax({
      url: `${url}?${$.param({
          "email": idHash
        })}`,
      crossDomain: true,
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${otp}`
      }
    }).done(function () {
      if (callback) {
        callback();
      }
    }).fail(function (reason) {
      console.error(reason.statusText);
    });
  });
}

function onceOffPayment(callback) {
  let url = `${baseUrl}/membership/onceoffpayment`;

  fetchOTP(function(otp) {
    $.ajax({
      url,
      crossDomain: true,
      data: {
        email: idHash
      },
      headers: {
        Authorization: `Bearer ${otp}`
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
      console.error(reason.responseText);
    });
  });
}

function createSepaDD(callback) {
  let url = `${baseUrl}/membership/mandate`;
  let d = new Date();
  let formattedDate = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();

  // Step 1: Create Mandate
  fetchOTP(function(otp) {
    $.ajax({
      url: `${url}?${$.param({
          "email": idHash
        })}`,
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
        Authorization: `Bearer ${otp}`
      }
    }).done(function () {
      console.info("Mandate created successfully");
      // Step 2: Create Subscription
      url = `${baseUrl}/membership/subscription`;
      fetchOTP(function(otp) {
        $.ajax({
          url: `${url}?${$.param({
              "email": idHash
            })}`,
          crossDomain: true,
          method: "POST",
          headers: {
            Authorization: `Bearer ${otp}`
          }
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
      });
    }).fail(function (reason) {
      console.error(reason.statusText);
      if (callback) {
        callback();
      }
    });
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
    return 'Wir haben keine Zahlungen gefundenn';
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
