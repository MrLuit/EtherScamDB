var reportType;
var args = {};

function finish() {
    $(".loading").fadeIn('', function() {
		$.post("", {
			reportType: reportType,
		    args: args
        }).done(function(data) {
            $(".loading").fadeOut('', function() {
                $(".end").fadeIn();
            });
        });
    });
}


window.addEventListener("load", function() {

    $('.ui.form')
        .form({
            fields: {
                name: 'empty',
                gender: 'empty',
                username: 'empty',
                password: ['minLength[6]', 'empty'],
                skills: ['minCount[2]', 'empty'],
                terms: 'checked',
                address: {
                    identifier: 'address',
                    rules: [{
                        type: '/^(0x)?[0-9a-f]{40}$/i',
                        prompt: 'Please enter a valid ethereum address'
                    }]
                }
            }
        });

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
    $("#3no").click(function() {
        $(".question3").fadeOut('', function() {
            $(".question5").fadeIn();
        });
    });

    $("#4senda").click(function() {
        reportType = 'urgentDomainReport';
        args['domain'] = $("#privdomain").val();
        $(".question4a").fadeOut('', function() {
            finish();
        });
    });
    $("#4sendb").click(function() {
        $(".question4b").fadeOut('', function() {
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
        $(".question7a").fadeOut('', function() {
            finish();
        });
    });
    $("#7sendb").click(function() {
        reportType = 'urgentMessageAddressReport';
        $(".question7b").fadeOut('', function() {
            finish();
        });
    });
    $("7sendc").click(function() {
        reportType = 'urgentUniqueAddressReport';
        $(".question7c").fadeOut('', function() {
            finish();
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
            finish();
        });
    });

    $("#10send").click(function() {
        args['reason'] = $("#reason").val();
        $(".question10").fadeOut('', function() {
            finish();
        });
    });

});