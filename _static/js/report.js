var reportType;
var args = {};

function finish() {
    $(".captcha").fadeOut('', function() {
        $(".loading").fadeIn('', function() {
            $.post("https://lu1t.nl/report.php", {
                reportType: reportType,
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

    $("#1yes").click(function() {
        $(".question1").fadeOut('', function() {
            $(".question2a").fadeIn();
        });
    });
    $("#1notsure").click(function() {
        $(".question1").fadeOut('', function() {
            $(".question2b").fadeIn();
        });
    });
    $("#1no").click(function() {
        $(".question1").fadeOut('', function() {
            $(".question8").fadeIn();
        });
    });

    $("#2senda").click(function() {
        args['from'] = $("#from").val();
        args['to'] = $("#to").val();
        $(".question2a").fadeOut('', function() {
            $(".question3").fadeIn();
        });
    });
    $("#2sendb").click(function() {
        $(".question2b").fadeOut('', function() {
            $(".question1").fadeIn();
        });
    });
    $("#2returna").click(function() {
        $(".question2a").fadeOut('', function() {
            $(".question1").fadeIn();
        });
    });

    $("#3yes").click(function() {
        $(".question3").fadeOut('', function() {
            $(".question4a").fadeIn();
        });
    });
    $("#3notsure").click(function() {
        $(".question3").fadeOut('', function() {
            $(".question4b").fadeIn();
        });
    });
    $("#3notsure2").click(function() {
        $(".question3").fadeOut('', function() {
            $(".question4b").fadeIn();
        });
    });
    $("#3no").click(function() {
        $(".question3").fadeOut('', function() {
            $(".question5").fadeIn();
        });
    });

    $("#4senda").click(function() {
        reportType = 'urgentDomainReport';
        args['domain'] = $("#privdomain").val();
        $(".question4a").fadeOut('', function() {
            $(".captcha").fadeIn();
        });
    });
    $("#4sendb").click(function() {
        $(".question4b").fadeOut('', function() {
            $(".question3").fadeIn();
        });
    });
    $("#4returna").click(function() {
        $(".question4a").fadeOut('', function() {
            $(".question3").fadeIn();
        });
    });

    $("#5yes").click(function() {
        $(".question5").fadeOut('', function() {
            $(".question6").fadeIn();
        });
    });
    $("#5no").click(function() {
        $(".question5").fadeOut('', function() {
            $(".question8").fadeIn();
        });
    });

    $("#6website").click(function() {
        $(".question6").fadeOut('', function() {
            $(".question7a").fadeIn();
        });
    });
    $("#6message").click(function() {
        $(".question6").fadeOut('', function() {
            $(".question7b").fadeIn();
        });
    });
    $("#6else").click(function() {
        $(".question6").fadeOut('', function() {
            $(".question7c").fadeIn();
        });
    });

    $("#7senda").click(function() {
        reportType = 'urgentDomainAddressReport';
        args['message'] = $("#addresswebsite").val();
        $(".question7a").fadeOut('', function() {
            $(".captcha").fadeIn();
        });
    });
    $("#7sendb").click(function() {
        reportType = 'urgentMessageAddressReport';
        args['message'] = $("#addressmessage").val();
        $(".question7b").fadeOut('', function() {
            $(".captcha").fadeIn();
        });
    });
    $("7sendc").click(function() {
        reportType = 'urgentUniqueAddressReport';
        args['message'] = $("#addressunique").val();
        $(".question7c").fadeOut('', function() {
            $(".captcha").fadeIn();
        });
    });
    $("#7returnc").click(function() {
        $(".question7c").fadeOut('', function() {
            $(".question6").fadeIn();
        });
    });

    $("#8domain").click(function() {
        $(".question8").fadeOut('', function() {
            $(".question9a").fadeIn();
        });
    });
    $("#8address").click(function() {
        $(".question8").fadeOut('', function() {
            $(".question9b").fadeIn();
        });
    });
    $("#8else").click(function() {
        $(".question8").fadeOut('', function() {
            $(".question9c").fadeIn();
        });
    });

    $("#9senda").click(function() {
        reportType = 'generalDomainReport';
        args['domain'] = $("#gendomain").val();
        $(".question9a").fadeOut('', function() {
            $(".question10").fadeIn();
        });
    });
    $("#9sendb").click(function() {
        reportType = 'generalAddressReport';
        args['address'] = $("#address").val();
        $(".question9b").fadeOut('', function() {
            $(".question10").fadeIn();
        });
    });
    $("#9sendc").click(function() {
        reportType = 'uniqueReport';
        args['unique'] = $("#uniquerep").val();
        $(".question9c").fadeOut('', function() {
            $(".captcha").fadeIn();
        });
    });
    $("#9returna").click(function() {
        $(".question9a").fadeOut('', function() {
            $(".question8").fadeIn();
        });
    });
    $("#9returnb").click(function() {
        $(".question9b").fadeOut('', function() {
            $(".question8").fadeIn();
        });
    });
    $("#9returnc").click(function() {
        $(".question9c").fadeOut('', function() {
            $(".question8").fadeIn();
        });
    });

    $("#10send").click(function() {
        args['reason'] = $("#reason").val();
        $(".question10").fadeOut('', function() {
            $(".captcha").fadeIn();
        });
    });
    $("#10return").click(function() {
        $(".question10").fadeOut('', function() {
            if (reportType == 'generalDomainReport') {
                $(".question9a").fadeIn();
            } else if (reportType == 'generalAddressReport') {
                $(".question9b").fadeIn();
            }
        });
    });

});