class CDU_OPTIONS_EXTERNALMCDU {
    static ShowPage(mcdu) {
        mcdu.clearDisplay();

        const externalMCDUEnabled = NXDataStore.get("CONFIG_EXTERNAL_MCDU_ENABLED", "false") === "true";
        /*const externalMCDUAddress = NXDataStore.get("CONFIG_EXTERNAL_MCDU_ADDRESS", "127.0.0.1");
        const externalMCDUPort = NXDataStore.get("CONFIG_EXTERNAL_MCDU_ADDRESS", 8080);*/

        const externalMCDUAddress = new CDU_SingleValueField(mcdu,
            "string",
            NXDataStore.get("CONFIG_EXTERNAL_MCDU_ADDRESS", "127.0.0.1"),
            {
                suffix: "[color]cyan",
                isValid: (value) => {
                    return /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/g.test(value);
                }
            },
            (value) => {
                NXDataStore.set("CONFIG_EXTERNAL_MCDU_ADDRESS", value);
                CDU_OPTIONS_EXTERNALMCDU.ShowPage(mcdu);
            }
        );

        const externalMCDUPort = new CDU_SingleValueField(mcdu,
            "int",
            NXDataStore.get("CONFIG_EXTERNAL_MCDU_PORT", 8080),
            {
                minValue: 1024,
                maxValue: 65353,
                suffix: "[color]cyan"
            },
            (value) => {
                NXDataStore.set("CONFIG_EXTERNAL_MCDU_PORT", `${value}`);
                CDU_OPTIONS_EXTERNALMCDU.ShowPage(mcdu);
            }
        );

        mcdu.setTemplate([
            ["A32NX OPTIONS EXT MCDU"],
            ["\xa0SERVER ADDRESS"],
            [externalMCDUAddress],
            ["\xa0PORT"],
            [externalMCDUPort],
            [""],
            [""],
            [""],
            [""],
            [""],
            [""],
            ["", mcdu.socketStatus !== "DISCONNECTED" ? mcdu.socketStatus : ""],
            ["<RETURN", mcdu.socketStatus === "CONNECTED" ? "DISCONNECT*[color]amber" : "CONNECT*[color]cyan"]
        ]);

        mcdu.page.Current = mcdu.page.OptionsExternalMCDU;

        mcdu.page.SelfPtr = setTimeout(() => {
            if (mcdu.page.Current === mcdu.page.OptionsExternalMCDU) {
                CDU_OPTIONS_EXTERNALMCDU.ShowPage(mcdu);
            }
        }, 500);

        mcdu.onRightInput[5] = () => {
            if (mcdu.socketStatus === "CONNECTED") {
                mcdu.socket.close();
                CDU_OPTIONS_EXTERNALMCDU.ShowPage(mcdu);
            } else {
                mcdu.connectWebsocket();
                CDU_OPTIONS_EXTERNALMCDU.ShowPage(mcdu);
            }
        };

        mcdu.leftInputDelay[5] = () => {
            return mcdu.getDelaySwitchPage();
        };
        mcdu.onLeftInput[5] = () => {
            CDU_OPTIONS_HARDWARE.ShowPage(mcdu);
        };
    }
}
