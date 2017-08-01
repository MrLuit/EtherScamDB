window.addEventListener("load", function() {
    $.getJSON("https://freegeoip.net/json/" + $("h1").html(), function(data) {
        flag = '<i class="' + data.country_code.toLowerCase() + ' flag"></i>';
        $("#location").html('<span>' + flag + data.country_name + '</span>');
        $("#map").html('<iframe width="100%" height="400px" frameborder="0" style="border:0" src="https://www.google.com/maps/embed/v1/place?key=AIzaSyBw2MrKbJrjg6NYIq6kClIVvUx3vSj-a1s&q=' + data.latitude + ',' + data.longitude + '" allowfullscreen></iframe>');
    });
});