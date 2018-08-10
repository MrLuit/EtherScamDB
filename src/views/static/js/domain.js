window.addEventListener("load", function() {
    $("#shr").val(location.href);
    $("#gen").click(function() {
        $('#abusemodal').modal('show');
    });
    $("#history").click(function() {
        $('#historymodal').modal('show');
    });
    $("#share").click(function() {
        $('#sharemodal').modal('show');
    });
});

function copyshr() {
    document.getElementById("shr").select();
    document.execCommand("copy");
}

function copyabuse() {
    document.getElementById("abuse").select();
    document.execCommand("copy");
}