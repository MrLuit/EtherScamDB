module.exports = (scam) => {
    let abusereport = "";
    abusereport += "I would like to inform you of suspicious activities at the domain " + scam.getHostname();
    if ('ip' in scam && scam.ip) {
        abusereport += " located at IP address " + scam['ip'] + ".";
    } else {
        abusereport += ".";
    }
    if ('subcategory' in scam && scam.subcategory == "MyEtherWallet") {
        abusereport += "The domain is impersonating MyEtherWallet.com, a website where people can create Ethereum wallets (a cryptocurrency like Bitcoin).";
    } else if ('subcategory' in scam && scam.subcategory == "MyCrypto") {
        abusereport += "The domain is impersonating MyCrypto.com, a website where people can create Ethereum wallets (a cryptocurrency like Bitcoin).";
    } else if ('subcategory' in scam && scam.subcategory == "Classic Ether Wallet") {
        abusereport += "The domain is impersonating classicetherwallet.com, a website where people can create Ethereum Classic wallets (a cryptocurrency like Bitcoin).";
    } else if ('category' in scam && scam.category == "Fake ICO") {
        abusereport += "The domain is impersonating a website where an ICO is being held (initial coin offering, like an initial public offering but it's for cryptocurrencies).";
    }
    if ('category' in scam && scam.category == "Phishing") {
        abusereport += "\r\n\r\nThe attackers wish to steal funds by using phishing to get the victim's private keys (passwords to a wallet) and using them to send funds to their own wallets.";
    } else if ('category' in scam && scam.category == "Fake ICO") {
        abusereport += "\r\n\r\nThe attackers wish to steal funds by cloning the real website and changing the ethereum address so people will send funds to the attackers' address instead of the real address.";
    }
    abusereport += "\r\n\r\nPlease shut down this domain so further attacks will be prevented.";
    return abusereport;
}