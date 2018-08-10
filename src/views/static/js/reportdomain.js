var reportType;
var args = {};

function finish() {
    $(".captcha").fadeOut('', function() {
        $(".loading").fadeIn('', function() {
            $.post("https://lu1t.nl/report.php", {
                reportType: 'generalDomainReport',
                args: args
            }).done(function(data) {
                $(".loading").fadeOut('', function() {
                    $(".end").fadeIn();
                });
            });
        });
    });
}

function reCaptchaVerify(response) {
    if (response === document.querySelector('.g-recaptcha-response').value) {
        args['captcha'] = response;
        finish();
    }
}

function reCaptchaExpired() {
    /* do something when it expires */
}

function reCaptchaCallback() {
    grecaptcha.render('g-recaptcha', {
        'sitekey': '6LfTSysUAAAAAOIYE_x9aZuqBNRlzTRbHlMRpAiK',
        'callback': reCaptchaVerify,
        'expired-callback': reCaptchaExpired
    });
}

window.addEventListener("load", function() {
    var results = new RegExp('[\?&]([^&#]*)').exec(window.location.href);
    if (results != null) {
        $("#gendomain").val(decodeURIComponent(results[1]).toString() || 0);
    }
    $("#9senda").click(function() {
        args['domain'] = $("#gendomain").val();
        $(".question9a").fadeOut('', function() {
            $(".question10").fadeIn();
        });
    });

    $("#10send").click(function() {
        args['reason'] = $("#reason").val();
        $(".question10").fadeOut('', function() {
            $(".captcha").fadeIn();
        });
    });

});