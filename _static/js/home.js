window.addEventListener("load", function() {
	$("#github").click(function() {
		window.location = 'https://github.com/MrLuit/EtherScamDB';
	});
	$("#scams").click(function() {
		window.location = '/scams';
	});
	$("#report").click(function() {
		window.location = '/report';
	});
	$("#donate").click(function() {
		window.location = 'https://etherscan.io/address/etherscamdb.eth';
	});
});