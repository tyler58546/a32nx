class A320_Neo_CDU_MainDisplay extends FMCMainDisplay {
    constructor() {
        super(...arguments);
        this._registered = false;
        this._forceNextAltitudeUpdate = false;
        this._lastUpdateAPTime = NaN;
        this.refreshFlightPlanCooldown = 0;
        this.updateAutopilotCooldown = 0;
        this._lastHasReachFlex = false;
        this._apMasterStatus = false;
        this._hasReachedTopOfDescent = false;
        this._apCooldown = 500;
        this._lastRequestedFLCModeWaypointIndex = -1;
        this._cruiseEntered = false;
        this._blockFuelEntered = false;
        this._gpsprimaryack = 0;
        this.speedLimit = 250;
        this.speedLimitAltitude = 10000;
        this.transitionAltitude = 18000;
    }
    get templateID() {
        return "A320_Neo_CDU";
    }
    connectedCallback() {
        super.connectedCallback();
        RegisterViewListener("JS_LISTENER_KEYEVENT", () => {
            console.log("JS_LISTENER_KEYEVENT registered.");
            RegisterViewListener("JS_LISTENER_FACILITY", () => {
                console.log("JS_LISTENER_FACILITY registered.");
                this._registered = true;
            });
        });
    }
    Init() {
        super.Init();
        this.A32NXCore = new A32NX_Core();
        this.A32NXCore.init(this._lastTime);

        this.defaultInputErrorMessage = "NOT ALLOWED";
        this.onDir = () => {
            CDUDirectToPage.ShowPage(this);
        };
        this.onProg = () => {
            CDUProgressPage.ShowPage(this);
        };
        this.onPerf = () => {
            CDUPerformancePage.ShowPage(this);
        };
        this.onInit = () => {
            CDUInitPage.ShowPage1(this);
        };
        this.onData = () => {
            CDUDataIndexPage.ShowPage1(this);
        };
        this.onFpln = () => {
            CDUFlightPlanPage.ShowPage(this);
        };
        this.onRad = () => {
            CDUNavRadioPage.ShowPage(this);
        };
        this.onFuel = () => {
            CDUFuelPredPage.ShowPage(this);
        };
        const mcduStartPage = SimVar.GetSimVarValue("L:A320_NEO_CDU_START_PAGE", "number");
        if (mcduStartPage < 1) {
            if (mcduStartPage < 1) {
                CDUIdentPage.ShowPage(this);
            } else if (mcduStartPage === 10) {
                CDUDirectToPage.ShowPage(this);
            } else if (mcduStartPage === 20) {
                CDUProgressPage.ShowPage(this);
            } else if (mcduStartPage === 30) {
                CDUPerformancePage.ShowPage(this);
            } else if (mcduStartPage === 31) {
                CDUPerformancePage.ShowTAKEOFFPage(this);
            } else if (mcduStartPage === 32) {
                CDUPerformancePage.ShowCLBPage(this);
            } else if (mcduStartPage === 33) {
                CDUPerformancePage.ShowCRZPage(this);
            } else if (mcduStartPage === 34) {
                CDUPerformancePage.ShowDESPage(this);
            } else if (mcduStartPage === 35) {
                CDUPerformancePage.ShowAPPRPage(this);
            } else if (mcduStartPage === 40) {
                CDUInitPage.ShowPage1(this);
            } else if (mcduStartPage === 50) {
                CDUDataIndexPage.ShowPage(this);
            } else if (mcduStartPage === 60) {
                CDUFlightPlanPage.ShowPage(this);
            } else if (mcduStartPage === 70) {
                CDUNavRadioPage.ShowPage(this);
            } else if (mcduStartPage === 80) {
                CDUFuelPredPage.ShowPage(this);
            }
        }
        this.electricity = this.querySelector("#Electricity");
        this.climbTransitionGroundAltitude = null;
    }

    setTemplate(_template) {
        super.setTemplate(_template);
        this._lineElements.forEach((row) => {
            row.forEach((column) => {
                if (column != null) {
                    column.innerHTML = column.innerHTML.replace(/{sp}/g, "&nbsp;");
                    column.innerHTML = column.innerHTML.replace(/{small}/g, "<span class='s-text'>");
                    column.innerHTML = column.innerHTML.replace(/{large}/g, "<span class='l-text'>");
                    column.innerHTML = column.innerHTML.replace(/{red}/g, "<span class='red'>");
                    column.innerHTML = column.innerHTML.replace(/{green}/g, "<span class='green'>");
                    column.innerHTML = column.innerHTML.replace(/{blue}/g, "<span class='blue'>");
                    column.innerHTML = column.innerHTML.replace(/{white}/g, "<span class='white'>");
                    column.innerHTML = column.innerHTML.replace(/{magenta}/g, "<span class='magenta'>");
                    column.innerHTML = column.innerHTML.replace(/{end}/g, "</span>");
                }
            });
        });
        this._labelElements.forEach((row) => {
            row.forEach((column) => {
                if (column != null) {
                    column.innerHTML = column.innerHTML.replace(/{sp}/g, "&nbsp;");
                }
            });
        });
    }

    trySetFlapsTHS(s) {
        if (s) {
            let validEntry = false;
            let nextFlaps = this.flaps;
            let nextThs = this.ths;
            let [flaps, ths] = s.split("/");

            // Parse flaps
            if (flaps && flaps.length > 0) {
                if (!/^\d+$/.test(flaps)) {
                    this.showErrorMessage("FORMAT ERROR");
                    return false;
                }

                const vFlaps = parseInt(flaps);
                if (isFinite(vFlaps) && vFlaps > 0 && vFlaps < 4) {
                    nextFlaps = vFlaps;
                    validEntry = true;
                }
            }

            // Parse THS
            if (ths) {
                if (!/^((UP|DN)(\d?\.?\d)|(\d?\.?\d)(UP|DN))$/.test(ths)) {
                    this.showErrorMessage("FORMAT ERROR");
                    return false;
                }

                let direction = null;
                ths = ths.replace(/(UP|DN)/g, (substr) => {
                    direction = substr;
                    return "";
                });

                if (direction) {
                    const vThs = parseFloat(ths.trim());
                    if (isFinite(vThs) && vThs >= 0.0 && vThs <= 2.5) {

                        if (vThs === 0.0) {
                            // DN0.0 should be corrected to UP0.0
                            direction = "UP";
                        }

                        nextThs = `${direction}${vThs.toFixed(1)}`;
                        validEntry = true;
                    }
                }
            }

            // Commit changes.
            if (validEntry) {
                this.flaps = nextFlaps;
                this.ths = nextThs;
                return true;
            }
        }

        this.showErrorMessage("INVALID ENTRY");
        return false;
    }
    onPowerOn() {
        super.onPowerOn();
        if (Simplane.getAutoPilotAirspeedManaged()) {
            this._onModeManagedSpeed();
        } else if (Simplane.getAutoPilotAirspeedSelected()) {
            this._onModeSelectedSpeed();
        }
        this._onModeManagedHeading();
        this._onModeManagedAltitude();

        CDUPerformancePage.UpdateThrRedAccFromOrigin(this);

        SimVar.SetSimVarValue("K:VS_SLOT_INDEX_SET", "number", 1);

        this.taxiFuelWeight = 0.2;
        CDUInitPage.updateTowIfNeeded(this);
    }
    Update() {
        super.Update();

        this.A32NXCore.update();

        this.updateAutopilot();

        this.updateScreenState();

        this.updatePredictions();

        //Checking the GPS Primary State and displaying the message accordingly.
        var GPSPrimary = SimVar.GetSimVarValue("L:GPSPrimary", "bool");
        var GPSPrimaryAck = SimVar.GetSimVarValue("L:GPSPrimaryAcknowledged", "bool");
        if (this.inOut.length <= 0) { //First Time When Aircraft Loaded
            if (GPSPrimary && !GPSPrimaryAck) {
                this.lastUserInput = "";
                this.showErrorMessage("GPS PRIMARY");
                this._inOutElement.style.color = "#ffffff";
                SimVar.SetSimVarValue("L:GPSPrimaryMessageDisplayed", "bool", 1);
            } else if (!GPSPrimaryAck && !GPSPrimary) {
                this.lastUserInput = "";
                this.showErrorMessage("GPS PRIMARY LOST");
                this._inOutElement.style.color = "#FFBF00";
                SimVar.SetSimVarValue("L:GPSPrimaryMessageDisplayed", "bool", 1);
            } else {
                if (this.inOut == "GPS PRIMARY" || this.inOut == "GPS PRIMARY LOST") { //Clear the GPS Messages if not cleared before
                    this.showErrorMessage("");
                }
                this._inOutElement.style.color = "#ffffff";
                SimVar.SetSimVarValue("L:GPSPrimaryMessageDisplayed", "bool", 0);
            }
        } else { //Subsequent Times - To handle the IRS Alignment changes in the middle of the session.
            if (this.inOut != "GPS PRIMARY" && this.inOut != "GPS PRIMARY LOST") {
                this._inOutElement.style.color = "#ffffff";
                SimVar.SetSimVarValue("L:GPSPrimaryMessageDisplayed", "bool", 0);
            } else {
                if (GPSPrimary && !GPSPrimaryAck) {
                    this.lastUserInput = "";
                    this.showErrorMessage("GPS PRIMARY");
                    this._inOutElement.style.color = "#ffffff";
                    SimVar.SetSimVarValue("L:GPSPrimaryMessageDisplayed", "bool", 1);
                } else if (!GPSPrimaryAck && !GPSPrimary) {
                    this.lastUserInput = "";
                    this.showErrorMessage("GPS PRIMARY LOST");
                    this._inOutElement.style.color = "#FFBF00";
                    SimVar.SetSimVarValue("L:GPSPrimaryMessageDisplayed", "bool", 1);
                } else {
                    if (this.inOut == "GPS PRIMARY" || this.inOut == "GPS PRIMARY LOST") { //Clear the GPS Messages if not cleared before
                        this.showErrorMessage("");
                    }
                    this._inOutElement.style.color = "#ffffff";
                    SimVar.SetSimVarValue("L:GPSPrimaryMessageDisplayed", "bool", 0);
                }
            }
        }
    }

    getIsFlying() {
        return this.currentFlightPhase > FlightPhase.FLIGHT_PHASE_TAKEOFF;
    }

    updateScreenState() {
        if (SimVar.GetSimVarValue("L:ACPowerAvailable","bool")) {
            this.electricity.style.display = "block";
        } else {
            this.electricity.style.display = "none";
        }
    }

    getClbManagedSpeed(_altitude = Simplane.getAltitude(), _flaps = Simplane.getFlapsHandleIndex()) {
        let maxSpeed = Infinity;
        if (isFinite(this.v2Speed)) {
            if (_altitude < this.thrustReductionAltitude) {
                maxSpeed = this.v2Speed + 50;
            }
        }
        if (_flaps != 0) {
            return Math.min(maxSpeed, this.getFlapSpeed());
        }
        let dCI = this.costIndex / 999;
        dCI = dCI * dCI;
        let speed = 290 * (1 - dCI) + 330 * dCI;
        if (_altitude < this.speedLimitAltitude) {
            speed = Math.min(speed, this.speedLimit);
        }
        return Math.min(maxSpeed, speed);
    }
    getCrzManagedSpeed(_altitude = Simplane.getAltitude(), _flaps = Simplane.getFlapsHandleIndex()) {
        let dCI = this.costIndex / 999;
        dCI = dCI * dCI;
        if (_flaps != 0) {

            return this.getFlapSpeed();
        }
        let speed = 285 * (1 - dCI) + 310 * dCI;
        if (_altitude < this.speedLimitAltitude) {
            speed = Math.min(speed, this.speedLimit);
        }
        return speed;
    }
    getDesManagedSpeed(_altitude = Simplane.getAltitude(), _flaps = Simplane.getFlapsHandleIndex()) {
        const dCI = this.costIndex / 999;
        if (_flaps != 0) {

            return this.getFlapSpeed();
        }
        let speed = 240 * (1 - dCI) + 260 * dCI;
        if (_altitude < this.speedLimitAltitude) {
            speed = Math.min(speed, this.speedLimit);
        }
        return speed;
    }
    getFlapTakeOffSpeed() {
        const dWeight = (this.getWeight() - 47) / (78 - 47);
        return 119 + 34 * dWeight;
    }
    getSlatTakeOffSpeed() {
        const dWeight = (this.getWeight() - 47) / (78 - 47);
        return 154 + 44 * dWeight;
    }

    /**
     * Get aircraft takeoff and approach green dot speed
     * Calculation:
     * Gross weight in thousandths (KG) * 2 + 85 when below FL200
     * @returns {number}
     */
    getPerfGreenDotSpeed() {
        return ((this.getGrossWeight("kg") / 1000) * 2) + 85;
    }

    /**
     * Get the gross weight of the aircraft from the addition
     * of the ZFW, fuel and payload.
     * @param unit
     * @returns {number}
     */
    getGrossWeight(unit) {
        const fuelWeight = SimVar.GetSimVarValue("FUEL TOTAL QUANTITY WEIGHT", unit);
        const emptyWeight = SimVar.GetSimVarValue("EMPTY WEIGHT", unit);
        const payloadWeight = this.getPayloadWeight(unit);
        return Math.round(emptyWeight + fuelWeight + payloadWeight);
    }

    /**
     * Get the payload of the aircraft, taking in to account each
     * payload station
     * @param unit
     * @returns {number}
     */
    getPayloadWeight(unit) {
        const payloadCount = SimVar.GetSimVarValue("PAYLOAD STATION COUNT", "number");
        let payloadWeight = 0;
        for (let i = 1; i <= payloadCount; i++) {
            payloadWeight += SimVar.GetSimVarValue(`PAYLOAD STATION WEIGHT:${i}`, unit);
        }
        return payloadWeight;
    }

    getMarkerPosition(_distance, _waypoints) {

        if (_waypoints.length < 2) {
            return {
                latitude: NaN,
                longitude: NaN,
                heading: NaN,
                index: NaN
            };
        }

        let prevWaypoint = _waypoints[0].wp;
        let nextWaypoint = _waypoints[1].wp;
        for (var i = 0; _waypoints[i].wp.cumulativeDistanceInFP < _distance && i < _waypoints.length - 1; i++) {
            prevWaypoint = _waypoints[i].wp;
            nextWaypoint = _waypoints[i + 1].wp;
        }
        const f = ((_distance - prevWaypoint.cumulativeDistanceInFP) / (nextWaypoint.cumulativeDistanceInFP - prevWaypoint.cumulativeDistanceInFP));
        return {
            latitude: Avionics.Utils.lerpAngle(prevWaypoint.infos.lat, nextWaypoint.infos.lat, f),
            longitude: Avionics.Utils.lerpAngle(prevWaypoint.infos.long, nextWaypoint.infos.long, f),
            heading: nextWaypoint.bearingInFP,
            index: i
        };
    }

    getActiveAltitudeConstraint(_waypoints, _index) {
        let output = {
            altitude: null,
            distance: null,
        };
        for (let i = 0; i <= _index; i++) {
            const waypoint = _waypoints[i].wp;
            if (waypoint.legAltitudeDescription !== 0) {
                let alt = waypoint.legAltitude1;
                if (waypoint.legAltitudeDescription === 4) {
                    alt = (waypoint.legAltitude1 + waypoint.legAltitude2) * 0.5;
                }
                if (alt < (this.cruiseFlightLevel * 100) - 5) {
                    output = {
                        altitude: alt,
                        distance: waypoint.cumulativeDistanceInFP
                    };
                }
            }
        }
        return output;
    }

    getNextAltitudeConstraint(_waypoints, _index, _types = [1,2,3,4]) {
        for (let i = _index; i < _waypoints.length; i++) {
            const waypoint = _waypoints[i].wp;
            if (_types.includes(waypoint.legAltitudeDescription)) {
                let alt = waypoint.legAltitude1;
                if (waypoint.legAltitudeDescription === 4) {
                    alt = (waypoint.legAltitude1 + waypoint.legAltitude2) * 0.5;
                }
                if (alt < (this.cruiseFlightLevel * 100) - 5) {
                    return {
                        altitude: alt,
                        distance: waypoint.cumulativeDistanceInFP
                    };
                }
            }
        }
        return {
            altitude: null,
            distance: null,
        };
    }

    getTakeoffAltitude() {
        const origin = this.flightPlanManager.getOrigin();
        if (origin) {
            return origin.altitudeinFP;
        }
        return 0;
    }

    getLandingAltitude() {
        const dest = this.flightPlanManager.getDestination();
        if (dest) {
            return dest.altitudeinFP;
        }
        return 0;
    }

    predictClimbDistance(_waypoints, _startAltitude, _endAltitude, _indicatedAirspeed = 250) {
        for (let i = 0; i < _waypoints.length - 1; i++) {
            const waypoint = _waypoints[i].wp;

            if (waypoint.legAltitudeDescription != 0 || i == 0) {

                const waypointDistance = waypoint.cumulativeDistanceInFP;
                let waypointAltitude = waypoint.legAltitude1 || this.getTakeoffAltitude();

                if (waypoint.legAltitudeDescription === 4) {
                    waypointAltitude = (waypoint.legAltitude1 + waypoint.legAltitude2) * 0.5;
                }

                const nextConstraint = this.getNextAltitudeConstraint(_waypoints, i, [1,3,4]);

                const nextConstraintAltitude = nextConstraint.altitude || this.getLandingAltitude();
                const nextConstraintDistance = nextConstraint.distance || this.flightPlanManager.getDestination().cumulativeDistanceInFP;

                if (nextConstraintAltitude >= _endAltitude) {
                    return this.predictTopOfClimb(_waypoints, waypointAltitude, waypointDistance, _endAltitude, _indicatedAirspeed);
                }

                const totalDistance = nextConstraintDistance - waypointDistance;

                const climbDistance = -1 * this.predictTopOfClimb(_waypoints, waypointAltitude, 0, this.cruiseFlightLevel * 100, _indicatedAirspeed);
                const descentDistance = this.predictTopOfDescent(nextConstraintAltitude, totalDistance, this.predictGroundSpeed(this.getDesManagedSpeed(), this.calculateAverageAltitude(this.cruiseFlightLevel * 100, nextConstraintAltitude)), this.cruiseFlightLevel * 100);

                if (climbDistance + descentDistance < totalDistance) {
                    return this.predictTopOfClimb(_waypoints, waypointAltitude, waypointDistance, _endAltitude, _indicatedAirspeed);
                }
            }

        }
    }

    predictClimbAltitude(_waypoints, _distance, _indicatedAirspeed = 250) {
        let output = NaN;
        for (let i = 0; _waypoints[i].wp.cumulativeDistanceInFP < _distance; i++) {
            const waypoint = _waypoints[i].wp;

            if (waypoint.legAltitudeDescription != 0 || i == 0) {

                const waypointDistance = waypoint.cumulativeDistanceInFP;
                let waypointAltitude = waypoint.legAltitude1 || this.getTakeoffAltitude();

                if (waypoint.legAltitudeDescription === 4) {
                    waypointAltitude = (waypoint.legAltitude1 + waypoint.legAltitude2) * 0.5;
                }

                const nextConstraint = this.getNextAltitudeConstraint(_waypoints, i, [1,3,4]);

                const nextConstraintAltitude = nextConstraint.altitude || this.getLandingAltitude();
                const nextConstraintDistance = nextConstraint.distance || this.flightPlanManager.getDestination().cumulativeDistanceInFP;

                const totalDistance = nextConstraintDistance - waypointDistance;

                const climbDistance = -1 * this.predictTopOfClimb(_waypoints, waypointAltitude, 0, this.cruiseFlightLevel * 100, _indicatedAirspeed);
                const descentDistance = this.predictTopOfDescent(nextConstraintAltitude, totalDistance, this.predictGroundSpeed(this.getDesManagedSpeed(), this.calculateAverageAltitude(this.cruiseFlightLevel * 100, nextConstraintAltitude)), this.cruiseFlightLevel * 100);

                if (climbDistance + descentDistance < totalDistance) {
                    const speed = this.predictSpeedAtDistance(waypoint.cumulativeDistanceInFP);
                    const distance = _distance - waypoint.cumulativeDistanceInFP;
                    const duration1 = 108.27 + ((-4.36e-3) * waypointAltitude) + (7.33e-7 * Math.pow(waypointAltitude, 2));
                    const duration2 = (distance / speed) * 60 * 60;
                    const x = duration2 - duration1;
                    if (x > 115) {
                        return 5.19533e-6 * Math.sqrt((50544015e9 * x) - 514469876205e7) + 2974.08;
                    } else {
                        return 35 * x;
                    }
                } else {
                    const a = waypointAltitude;
                    const b = nextConstraintAltitude;
                    const x = (waypointDistance - this.getCurrentDistanceInFP()) / totalDistance;
                    output = a + (b - a) * x;
                }
            }

        }
        return output;
    }

    calculateAverageAltitude(a, b) {
        return (a + b) / 2;
    }

    calculatePressureAtAltitude(_altitude) {
        const m = -0.000643908531686;
        const b = 29.92126;
        return (m * _altitude) + b;
    }

    predictGroundSpeed(_indicatedAirspeed, _altitude) {
        const pressure = this.calculatePressureAtAltitude(_altitude);
        //TODO: use better equation with mach and temp for TAS
        const trueAirspeed = _indicatedAirspeed * Math.sqrt(29.92126 / pressure);
        //TODO: account for wind
        return trueAirspeed;
    }

    predictTopOfClimb(_waypoints, _constraintAltitude, _constraintDistance, _targetAltitude, _indicatedAirspeed = 250) {
        //const vSpeed = this.predictClimbVSpeed(_waypoints, 0, );
        let previousClimbDuration = Math.max(0, 108.27 + ((-4.36e-3) * _constraintAltitude) + (7.33e-7 * Math.pow(_constraintAltitude, 2)));
        if (_constraintAltitude < 7500) {
            previousClimbDuration = _constraintAltitude / (4000 / 60);
        }
        let climbDuration = 108.27 + ((-4.36e-3) * _targetAltitude) + (7.33e-7 * Math.pow(_targetAltitude, 2));
        const averageAltitude = this.calculateAverageAltitude(_constraintAltitude, _targetAltitude);
        const groundSpeed = this.predictGroundSpeed(_indicatedAirspeed, averageAltitude);
        //console.error(groundSpeed);

        //console.warn(`pcd: ${previousClimbDuration} cdu: ${climbDuration} aa: ${averageAltitude} gs: ${groundSpeed}`);

        if (_targetAltitude < 7500) {
            climbDuration = _targetAltitude / (4000 / 60);
        }
        climbDuration -= previousClimbDuration;
        const climbDistance = (climbDuration / 60 / 60) * groundSpeed;
        //console.error(climbDuration);
        return _constraintDistance + climbDistance;
    }

    predictTopOfDescent(_constraintAltitude, _constraintDistance, _groundSpeed, _startAltitude) {
        const vSpeed = 2700;
        const descentDuration = Math.abs(_constraintAltitude - _startAltitude) / vSpeed / 60;
        const descentDistance = descentDuration * _groundSpeed;
        return _constraintDistance - descentDistance;
    }

    getCurrentDistanceInFP() {
        const activeWaypoint = this.flightPlanManager.getActiveWaypoint()
        if (activeWaypoint && activeWaypoint.cumulativeDistanceInFP) {
            return Math.max(0, this.flightPlanManager.getActiveWaypoint().cumulativeDistanceInFP - SimVar.GetSimVarValue("GPS WP DISTANCE", "Nautical miles"));
        }
        return NaN;
    }

    predictSpeedAtDistance(_distance, _waypoints = this.getWaypoints()) {

        //TODO: use predicted altitude

        if (!this.topOfClimb || !this.topOfDescent) {
            return NaN;
        }
        if (_distance <= this.topOfClimb) {
            return this.getClbManagedSpeed(_distance > this.limDist ? this.cruiseFlightLevel * 100 : this.speedLimitAltitude - 10, 0);
        } else if (_distance > this.topOfDescent) {
            return this.getDesManagedSpeed(this.cruiseFlightLevel * 100, 0);
        } else {
            return this.getCrzManagedSpeed(this.cruiseFlightLevel * 100, 0);
        }
    }

    predictAltitudeAtDistance(_waypoints, _distance) {
        if (!this.topOfClimb || !this.topOfDescent) {
            return NaN;
        }
        if (_distance < this.topOfClimb) {
            //TODO account for speed changes
            return this.predictClimbAltitude(_waypoints, _distance, this.getClbManagedSpeed(this.cruiseFlightLevel * 100, 0));
        } else if (_distance > this.topOfDescent) {
            //TODO
            return 0;
        } else {
            return this.cruiseFlightLevel * 100;
        }
    }

    predictFlightTimeAtWaypoint(_waypoints, _index) {
        if (!this.topOfClimb || !this.topOfDescent) {
            return NaN;
        }
        let predictedSpeed = this.getClbManagedSpeed(this.cruiseFlightLevel * 100, 0) || 250;
        let totalTime = 0;
        for (let i = 0; i <= _index; i++) {
            const waypoint = _waypoints[i].wp;
            const distance = waypoint.distanceInFP;
            //TODO: use actual predicted altitude
            const altitude = this.cruiseFlightLevel * 100;
            predictedSpeed = this.predictGroundSpeed(this.predictSpeedAtDistance(waypoint.cumulativeDistanceInFP), altitude);
            totalTime += (distance / predictedSpeed) * 60 * 60;
        }
        return totalTime;
    }

    predictFlightTimeAtDistance(_waypoints, _distance) {
        if (!this.topOfClimb || !this.topOfDescent) {
            return NaN;
        }

        let lastIndex = NaN;
        for (let i = 0; i < _waypoints.length; i++) {
            if (_waypoints[i].wp.cumulativeDistanceInFP < _distance) {
                lastIndex = i;
            }
        }

        let predictedSpeed = this.getClbManagedSpeed(0, 0) || 250;
        let totalTime = 0;
        let wpDistance = 0;
        for (let i = 0; i <= lastIndex; i++) {
            const waypoint = _waypoints[i].wp;
            wpDistance = waypoint.distanceInFP;
            //TODO: use actual predicted altitude
            const altitude = this.cruiseFlightLevel * 100;
            predictedSpeed = this.predictGroundSpeed(this.predictSpeedAtDistance(waypoint.cumulativeDistanceInFP), altitude);
            totalTime += (wpDistance / predictedSpeed) * 60 * 60;
        }
        totalTime += ((_distance - wpDistance) / predictedSpeed) * 60 * 60;
        return totalTime;
    }

    predictETEToWaypoint(_waypoints, _index) {
        return this.predictFlightTimeAtWaypoint(_waypoints, _index) - this.predictFlightTimeAtDistance(_waypoints, this.getCurrentDistanceInFP());
    }

    predictETEToDistance(_waypoints, _distance) {
        return this.predictFlightTimeAtDistance(_waypoints, _distance) - this.predictFlightTimeAtDistance(_waypoints, this.getCurrentDistanceInFP());
    }

    predictUTCAtWaypoint(_waypoints, _index) {
        const utc = SimVar.GetGlobalVarValue("ZULU TIME", "seconds");
        const ete = this.predictETEToWaypoint(_waypoints, _index);
        let prediction = utc + ete;
        while (prediction > 60 * 60 * 24) {
            prediction -= 60 * 60 * 24;
        }
        return prediction;
    }

    predictUTCAtDistance(_waypoints, _distance) {
        const utc = SimVar.GetGlobalVarValue("ZULU TIME", "seconds");
        const ete = this.predictETEToDistance(_waypoints, _distance);
        let prediction = utc + ete;
        while (prediction > 60 * 60 * 24) {
            prediction -= 60 * 60 * 24;
        }
        return prediction;
    }

    updatePredictions() {

        const waypoints = this.getWaypoints();

        if (!this.flightPlanManager.getDestination() || !this.flightPlanManager.getOrigin() || waypoints.length < 2 || !isFinite(this.costIndex) || !this._cruiseEntered || !this._zeroFuelWeightZFWCGEntered || !this._blockFuelEntered) {
            SimVar.SetSimVarValue("L:AIRLINER_FMS_SHOW_TOP_CLIMB", "number", 0);
            SimVar.SetSimVarValue("L:AIRLINER_FMS_SHOW_TOP_DSCNT", "number", 0);
            this.topOfClimb = null;
            this.topOfDescent = null;
            this.limDist = NaN;
            this.predictionsAvailable = false;
            return;
        }

        this.predictionsAvailable = true;

        this.limDist = this.predictClimbDistance(waypoints, 0, this.speedLimitAltitude, Math.max(this.getClbManagedSpeed(), this.speedLimit));

        //Top of Climb
        const topOfClimb = this.predictClimbDistance(waypoints, this.getTakeoffAltitude(), this.cruiseFlightLevel * 100);
        //const topOfClimb = this.predictTopOfClimb(waypoints, lastClimbConstraintAltitude, lastClimbConstraintDistance, this.cruiseFlightLevel*100);
        SimVar.SetSimVarValue("L:A32NX_TOC", "number", topOfClimb);
        this.topOfClimb = topOfClimb;
        const tocPosition = this.getMarkerPosition(topOfClimb, waypoints);
        SimVar.SetSimVarValue("L:AIRLINER_FMS_SHOW_TOP_CLIMB", "number", 1);
        SimVar.SetSimVarValue("L:AIRLINER_FMS_LAT_TOP_CLIMB", "number", tocPosition.latitude);
        SimVar.SetSimVarValue("L:AIRLINER_FMS_LONG_TOP_CLIMB", "number", tocPosition.longitude);
        SimVar.SetSimVarValue("L:AIRLINER_FMS_HEADING_TOP_CLIMB", "number", tocPosition.heading);

        //Top of Descent
        
        let firstDescentContraintAltitude = this.getLandingAltitude();
        let firstDescentContraintDistance = this.flightPlanManager.getDestination().cumulativeDistanceInFP;
        let topOfDescent = this.predictTopOfDescent(this.getLandingAltitude(), this.flightPlanManager.getDestination().cumulativeDistanceInFP, this.predictGroundSpeed(this.getDesManagedSpeed(this.cruiseFlightLevel * 100, 0), this.calculateAverageAltitude(this.cruiseFlightLevel * 100, firstDescentContraintAltitude)), this.cruiseFlightLevel * 100);
        for (let i = 0; i < waypoints.length; i++) {
            const waypoint = waypoints[i].wp;
            if (waypoint.cumulativeDistanceInFP > topOfClimb && ((this.isArrivalWaypoint(waypoint) && (waypoint.legAltitude1 > 500 || waypoint.legAltitudeDescription != 1)) || this.isApproachWaypoint(waypoint))) {
                if (waypoint.legAltitudeDescription == 1 || waypoint.legAltitudeDescription == 3) {
                    const alt = waypoint.legAltitude1;
                    if (alt < (this.cruiseFlightLevel * 100) - 5) {
                        firstDescentContraintAltitude = alt;
                        firstDescentContraintDistance = waypoint.cumulativeDistanceInFP;
                        topOfDescent = this.predictTopOfDescent(firstDescentContraintAltitude, firstDescentContraintDistance, this.predictGroundSpeed(this.getDesManagedSpeed(this.cruiseFlightLevel * 100, 0), this.calculateAverageAltitude(this.cruiseFlightLevel * 100, firstDescentContraintAltitude)), this.cruiseFlightLevel * 100);
                        if (topOfDescent > topOfClimb) {
                            //console.error(waypoint.icao);
                            break;
                        } else {
                            //console.error(waypoint.icao);
                        }
                    }
                }
            }
        }
        //console.warn("CONST ALT "+FirstDescentContraintAltitude+" CRZ "+this.cruiseFlightLevel+" DIST "+FirstDescentContraintDistance);

        SimVar.SetSimVarValue("L:A32NX_TOD", "number", topOfDescent);
        this.topOfDescent = topOfDescent;
        SimVar.SetSimVarValue("L:A32NX_TOD_DISTANCE", "number", topOfDescent - this.getCurrentDistanceInFP());

        const todPosition = this.getMarkerPosition(topOfDescent, waypoints);
        SimVar.SetSimVarValue("L:AIRLINER_FMS_SHOW_TOP_DSCNT", "number", 1);
        SimVar.SetSimVarValue("L:AIRLINER_FMS_LAT_TOP_DSCNT", "number", todPosition.latitude);
        SimVar.SetSimVarValue("L:AIRLINER_FMS_LONG_TOP_DSCNT", "number", todPosition.longitude);
        SimVar.SetSimVarValue("L:AIRLINER_FMS_HEADING_TOP_DSCNT", "number", todPosition.heading);
        this.todIndex = todPosition.index;
    }

    getWaypoints() {
        const waypointsWithDiscontinuities = [];
        for (let i = 0; i < this.flightPlanManager.getWaypointsCount(); i++) {
            const prev = waypointsWithDiscontinuities[waypointsWithDiscontinuities.length - 1];
            const wp = this.flightPlanManager.getWaypoint(i);
            if (!prev || (prev.wp && prev.wp.ident != wp.ident)) {
                waypointsWithDiscontinuities.push({ wp: this.flightPlanManager.getWaypoint(i), fpIndex: i });
            }
        }
        const approachWaypoints = this.flightPlanManager.getApproachWaypoints();
        const destination = waypointsWithDiscontinuities.pop();
        for (let i = 0; i < approachWaypoints.length; i++) {
            const prev = waypointsWithDiscontinuities[waypointsWithDiscontinuities.length - 1];
            const wp = approachWaypoints[i];
            if (!prev || (prev.wp && prev.wp.ident != wp.ident)) {
                waypointsWithDiscontinuities.push({
                    wp: wp,
                    fpIndex: -42
                });
            }
        }
        if (destination) {
            waypointsWithDiscontinuities.push(destination);
        }
        return waypointsWithDiscontinuities;
    }

    isDepartureWaypoint(_waypoint, _departureWaypoints = this.flightPlanManager.getDepartureWaypoints()) {
        for (const waypoint of _departureWaypoints) {
            if (waypoint.icao == _waypoint.icao) {
                return true;
            }
        }
        return false;
    }

    isArrivalWaypoint(_waypoint, _arrivalWaypoints = this.flightPlanManager.getArrivalWaypoints()) {
        for (const waypoint of _arrivalWaypoints) {
            if (waypoint.icao == _waypoint.icao) {
                return true;
            }
        }
        return false;
    }

    isApproachWaypoint(_waypoint, _approachWaypoints = this.flightPlanManager.getApproachWaypoints()) {
        for (const waypoint of _approachWaypoints) {
            if (waypoint.icao == _waypoint.icao) {
                return true;
            }
        }
        return false;
    }

    getLastDepartureWaypoint(_departureWaypoints = this.flightPlanManager.getDepartureWaypoints()) {
        let lastWaypoint = null;
        for (const waypoint of _departureWaypoints) {
            lastWaypoint = waypoint;
        }
        return lastWaypoint;
    }

    _onModeSelectedSpeed() {
        if (SimVar.GetSimVarValue("L:A320_FCU_SHOW_SELECTED_SPEED", "number") === 0) {
            const currentSpeed = Simplane.getIndicatedSpeed();
            this.setAPSelectedSpeed(currentSpeed, Aircraft.A320_NEO);
        }
        SimVar.SetSimVarValue("K:SPEED_SLOT_INDEX_SET", "number", 1);
    }
    _onModeManagedSpeed() {
        SimVar.SetSimVarValue("K:SPEED_SLOT_INDEX_SET", "number", 2);
        SimVar.SetSimVarValue("L:A320_FCU_SHOW_SELECTED_SPEED", "number", 0);
    }
    _onModeSelectedHeading() {
        if (SimVar.GetSimVarValue("AUTOPILOT APPROACH HOLD", "boolean")) {
            return;
        }
        if (!SimVar.GetSimVarValue("AUTOPILOT HEADING LOCK", "Boolean")) {
            SimVar.SetSimVarValue("K:AP_PANEL_HEADING_HOLD", "Number", 1);
        }
        SimVar.SetSimVarValue("K:HEADING_SLOT_INDEX_SET", "number", 1);
    }
    _onModeManagedHeading() {
        if (SimVar.GetSimVarValue("AUTOPILOT APPROACH HOLD", "boolean")) {
            return;
        }
        if (!SimVar.GetSimVarValue("AUTOPILOT HEADING LOCK", "Boolean")) {
            SimVar.SetSimVarValue("K:AP_PANEL_HEADING_HOLD", "Number", 1);
        }
        SimVar.SetSimVarValue("K:HEADING_SLOT_INDEX_SET", "number", 2);
        SimVar.SetSimVarValue("L:A320_FCU_SHOW_SELECTED_HEADING", "number", 0);
    }
    _onModeSelectedAltitude() {
        if (!Simplane.getAutoPilotGlideslopeHold()) {
            SimVar.SetSimVarValue("L:A320_NEO_FCU_FORCE_IDLE_VS", "Number", 1);
        }
        SimVar.SetSimVarValue("K:ALTITUDE_SLOT_INDEX_SET", "number", 1);
        Coherent.call("AP_ALT_VAR_SET_ENGLISH", 1, Simplane.getAutoPilotDisplayedAltitudeLockValue(), this._forceNextAltitudeUpdate);
    }
    _onModeManagedAltitude() {
        SimVar.SetSimVarValue("K:ALTITUDE_SLOT_INDEX_SET", "number", 2);
        Coherent.call("AP_ALT_VAR_SET_ENGLISH", 1, Simplane.getAutoPilotDisplayedAltitudeLockValue(), this._forceNextAltitudeUpdate);
        Coherent.call("AP_ALT_VAR_SET_ENGLISH", 2, Simplane.getAutoPilotDisplayedAltitudeLockValue(), this._forceNextAltitudeUpdate);
        if (!Simplane.getAutoPilotGlideslopeHold()) {
            this.requestCall(() => {
                SimVar.SetSimVarValue("L:A320_NEO_FCU_FORCE_IDLE_VS", "Number", 1);
            });
        }
    }
    onEvent(_event) {
        super.onEvent(_event);
        console.log("A320_Neo_CDU_MainDisplay onEvent " + _event);
        if (_event === "MODE_SELECTED_SPEED") {
            this._onModeSelectedSpeed();
        }
        if (_event === "MODE_MANAGED_SPEED") {
            if (this.flightPlanManager.getWaypointsCount() === 0) {
                return;
            }
            this._onModeManagedSpeed();
        }
        if (_event === "MODE_SELECTED_HEADING") {
            if (this.flightPlanManager.getWaypointsCount() === 0) {
                return;
            }
            if (Simplane.getAutoPilotHeadingManaged()) {
                if (SimVar.GetSimVarValue("L:A320_FCU_SHOW_SELECTED_HEADING", "number") === 0) {
                    const currentHeading = Simplane.getHeadingMagnetic();
                    Coherent.call("HEADING_BUG_SET", 1, currentHeading);
                }
            }
            this._onModeSelectedHeading();
        }
        if (_event === "MODE_MANAGED_HEADING") {
            if (this.flightPlanManager.getWaypointsCount() === 0) {
                return;
            }
            this._onModeManagedHeading();
        }
        if (_event === "MODE_SELECTED_ALTITUDE") {
            this._onModeSelectedAltitude();
        }
        if (_event === "MODE_MANAGED_ALTITUDE") {
            this._onModeManagedAltitude();
        }
        if (_event === "AP_DEC_SPEED" || _event === "AP_INC_SPEED") {
            if (SimVar.GetSimVarValue("L:A320_FCU_SHOW_SELECTED_SPEED", "number") === 0) {
                const currentSpeed = Simplane.getIndicatedSpeed();
                this.setAPSelectedSpeed(currentSpeed, Aircraft.A320_NEO);
            }
            SimVar.SetSimVarValue("L:A320_FCU_SHOW_SELECTED_SPEED", "number", 1);
        }
        if (_event === "AP_DEC_HEADING" || _event === "AP_INC_HEADING") {
            if (SimVar.GetSimVarValue("L:A320_FCU_SHOW_SELECTED_HEADING", "number") === 0) {
                const currentHeading = Simplane.getHeadingMagnetic();
                Coherent.call("HEADING_BUG_SET", 1, currentHeading);
            }
            SimVar.SetSimVarValue("L:A320_FCU_SHOW_SELECTED_HEADING", "number", 1);
        }

        //Clear event to set the acknowledged flag to 1, this in turn hides the GPS Primary Message in the ND.
        if (_event === "1_BTN_CLR") {
            var ack = SimVar.GetSimVarValue("L:GPSPrimaryAcknowledged", "bool");
            var isGPSPrimaryMessageDisplayed = SimVar.GetSimVarValue("L:GPSPrimaryMessageDisplayed", "bool");
            if (!ack && this._inOutElement.textContent == "" && isGPSPrimaryMessageDisplayed) {
                SimVar.SetSimVarValue("L:GPSPrimaryAcknowledged", "bool", 1);
                this.isDisplayingErrorMessage = false;
                this.showErrorMessage("");
                this._inOutElement.style.color = "#ffffff";
                SimVar.SetSimVarValue("L:GPSPrimaryMessageDisplayed", "bool", 0);
            }
        }
    }
    onFlightPhaseChanged() {
        if (this.currentFlightPhase === FlightPhase.FLIGHT_PHASE_CLIMB) {
            if (isFinite(this.preSelectedClbSpeed)) {
                this.setAPSelectedSpeed(this.preSelectedClbSpeed, Aircraft.A320_NEO);
                SimVar.SetSimVarValue("K:SPEED_SLOT_INDEX_SET", "number", 1);
            }
        } else if (this.currentFlightPhase === FlightPhase.FLIGHT_PHASE_CRUISE) {
            if (isFinite(this.preSelectedCrzSpeed)) {
                this.setAPSelectedSpeed(this.preSelectedCrzSpeed, Aircraft.A320_NEO);
                SimVar.SetSimVarValue("K:SPEED_SLOT_INDEX_SET", "number", 1);
            }
        } else if (this.currentFlightPhase === FlightPhase.FLIGHT_PHASE_DESCENT) {
            if (isFinite(this.preSelectedDesSpeed)) {
                this.setAPSelectedSpeed(this.preSelectedDesSpeed, Aircraft.A320_NEO);
                SimVar.SetSimVarValue("K:SPEED_SLOT_INDEX_SET", "number", 1);
            }
        }
    }
    onInputAircraftSpecific(input) {
        if (input === "DIR") {
            if (this.onDir) {
                this.onDir();
            }
            return true;
        } else if (input === "PROG") {
            if (this.onProg) {
                this.onProg();
            }
            return true;
        } else if (input === "PERF") {
            if (this.onPerf) {
                this.onPerf();
            }
            return true;
        } else if (input === "INIT") {
            if (this.onInit) {
                this.onInit();
            }
            return true;
        } else if (input === "DATA") {
            if (this.onData) {
                this.onData();
            }
            return true;
        } else if (input === "FPLN") {
            if (this.onFpln) {
                this.onFpln();
            }
            return true;
        } else if (input === "RAD") {
            if (this.onRad) {
                this.onRad();
            }
            return true;
        } else if (input === "FUEL") {
            if (this.onFuel) {
                this.onFuel();
            }
            return true;
        } else if (input === "SEC") {
            if (this.onSec) {
                this.onSec();
            }
            return true;
        } else if (input === "ATC") {
            if (this.onAtc) {
                this.onAtc();
            }
            return true;
        } else if (input === "MCDU") {
            if (this.onMcdu) {
                this.onMcdu();
            }
            return true;
        } else if (input === "AIRPORT") {
            if (this.onAirport) {
                this.onAirport();
            }
            return true;
        } else if (input === "UP") {
            if (this.onUp) {
                this.onUp();
            }
            return true;
        } else if (input === "DOWN") {
            if (this.onDown) {
                this.onDown();
            }
            return true;
        } else if (input === "LEFT") {
            if (this.onLeft) {
                this.onLeft();
            }
            return true;
        } else if (input === "RIGHT") {
            if (this.onRight) {
                this.onRight();
            }
        } else if (input === "OVFY") {
            if (this.onOvfy) {
                this.onOvfy();
            }
            return true;
        }
        return false;
    }
    clearDisplay() {
        super.clearDisplay();
        this.onUp = undefined;
        this.onDown = undefined;
        this.onLeft = undefined;
        this.onRight = undefined;
    }
    getOrSelectWaypointByIdent(ident, callback) {
        this.dataManager.GetWaypointsByIdent(ident).then((waypoints) => {
            if (!waypoints || waypoints.length === 0) {
                return callback(undefined);
            }
            if (waypoints.length === 1) {
                return callback(waypoints[0]);
            }
            A320_Neo_CDU_SelectWptPage.ShowPage(this, waypoints, callback);
        });
    }

    _getTempIndex() {
        const temp = SimVar.GetSimVarValue("AMBIENT TEMPERATURE", "celsius");
        if (temp < -10) {
            return 0;
        }
        if (temp < 0) {
            return 1;
        }
        if (temp < 10) {
            return 2;
        }
        if (temp < 20) {
            return 3;
        }
        if (temp < 30) {
            return 4;
        }
        if (temp < 40) {
            return 5;
        }
        if (temp < 43) {
            return 6;
        }
        if (temp < 45) {
            return 7;
        }
        if (temp < 47) {
            return 8;
        }
        if (temp < 49) {
            return 9;
        }
        if (temp < 51) {
            return 10;
        }
        if (temp < 53) {
            return 11;
        }
        if (temp < 55) {
            return 12;
        }
        if (temp < 57) {
            return 13;
        }
        if (temp < 59) {
            return 14;
        }
        if (temp < 61) {
            return 15;
        }
        if (temp < 63) {
            return 16;
        }
        if (temp < 65) {
            return 17;
        }
        if (temp < 66) {
            return 18;
        }
        return 19;
    }

    _getVSpeed(dWeightCoef, min, max) {
        let runwayCoef = 1.0;
        const runway = this.flightPlanManager.getDepartureRunway() || this.flightPlanManager.getDetectedCurrentRunway();
        if (runway) {
            const f = (runway.length - 1500) / (2500 - 1500);
            runwayCoef = Utils.Clamp(f, 0, 1);
        }

        const flapsHandleIndex = this.flaps || Simplane.getFlapsHandleIndex();

        let vSpeed = min * (1 - runwayCoef) + max * runwayCoef;
        vSpeed *= dWeightCoef;
        vSpeed += (flapsHandleIndex - 1) * 6;
        return Math.round(vSpeed);
    }

    _getV1Speed() {
        let dWeightCoef = (this.getWeight(true) - 100) / (175 - 100);
        dWeightCoef = Utils.Clamp(dWeightCoef, 0, 1);
        dWeightCoef = 0.7 + (1.0 - 0.7) * dWeightCoef;

        const tempIndex = this._getTempIndex();
        const min = A320_Neo_CDU_MainDisplay._v1sConf1[tempIndex][0];
        const max = A320_Neo_CDU_MainDisplay._v1sConf1[tempIndex][1];

        return this._getVSpeed(dWeightCoef, min, max);
    }
    _computeV1Speed() {
        // computeV1Speed is called by inherited class so it must remain,
        // but we need the calculation logic so that sits in it's own function now.
        const nextV1 = this._getV1Speed();
        this.v1Speed = nextV1;
        SimVar.SetSimVarValue("L:AIRLINER_V1_SPEED", "Knots", nextV1);
    }

    _getVRSpeed() {
        let dWeightCoef = (this.getWeight(true) - 100) / (175 - 100);
        dWeightCoef = Utils.Clamp(dWeightCoef, 0, 1);
        dWeightCoef = 0.695 + (0.985 - 0.695) * dWeightCoef;

        const tempIndex = this._getTempIndex();
        const min = A320_Neo_CDU_MainDisplay._vRsConf1[tempIndex][0];
        const max = A320_Neo_CDU_MainDisplay._vRsConf1[tempIndex][1];

        return this._getVSpeed(dWeightCoef, min, max);
    }
    _computeVRSpeed() {
        // computeVRSpeed is called by inherited class so it must remain,
        // but we need the calculation logic so that sits in it's own function now.
        const nextVR = this._getVRSpeed();
        this.vRSpeed = nextVR;
        SimVar.SetSimVarValue("L:AIRLINER_VR_SPEED", "Knots", nextVR);
    }

    _getV2Speed() {
        let dWeightCoef = (this.getWeight(true) - 100) / (175 - 100);
        dWeightCoef = Utils.Clamp(dWeightCoef, 0, 1);
        dWeightCoef = 0.71 + (0.96 - 0.71) * dWeightCoef;

        const tempIndex = this._getTempIndex();
        const min = A320_Neo_CDU_MainDisplay._v2sConf1[tempIndex][0];
        const max = A320_Neo_CDU_MainDisplay._v2sConf1[tempIndex][1];

        return this._getVSpeed(dWeightCoef, min, max);
    }
    _computeV2Speed() {
        // computeV2Speed is called by inherited class so it must remain,
        // but we need the calculation logic so that sits in it's own function now.
        const nextV2 = this._getV2Speed();
        this.v2Speed = nextV2;
        SimVar.SetSimVarValue("L:AIRLINER_V2_SPEED", "Knots", nextV2);
    }

    getThrustTakeOffLimit() {
        if (this.perfTOTemp <= 10) {
            return 92.8;
        }
        if (this.perfTOTemp <= 40) {
            return 92.8;
        }
        if (this.perfTOTemp <= 45) {
            return 92.2;
        }
        if (this.perfTOTemp <= 50) {
            return 90.5;
        }
        if (this.perfTOTemp <= 55) {
            return 88.8;
        }
        return 88.4;
    }
    getThrustClimbLimit() {
        return this.getThrustTakeOffLimit() - 8;
    }
    isAirspeedManaged() {
        return SimVar.GetSimVarValue("AUTOPILOT SPEED SLOT INDEX", "number") === 2;
    }
    isHeadingManaged() {
        return SimVar.GetSimVarValue("AUTOPILOT HEADING SLOT INDEX", "number") === 2;
    }
    isAltitudeManaged() {
        return SimVar.GetSimVarValue("AUTOPILOT ALTITUDE SLOT INDEX", "number") === 2;
    }
    isVerticalSpeedManaged() {
        return SimVar.GetSimVarValue("AUTOPILOT VS SLOT INDEX", "number") === 2;
    }
    updateAutopilot() {
        const now = performance.now();
        const dt = now - this._lastUpdateAPTime;
        let apLogicOn = (this._apMasterStatus || Simplane.getAutoPilotFlightDirectorActive(1));
        this._lastUpdateAPTime = now;
        if (isFinite(dt)) {
            this.updateAutopilotCooldown -= dt;
        }
        if (SimVar.GetSimVarValue("L:AIRLINER_FMC_FORCE_NEXT_UPDATE", "number") === 1) {
            SimVar.SetSimVarValue("L:AIRLINER_FMC_FORCE_NEXT_UPDATE", "number", 0);
            this.updateAutopilotCooldown = -1;
        }
        if (apLogicOn && this.currentFlightPhase >= FlightPhase.FLIGHT_PHASE_TAKEOFF) {
            if (this.isHeadingManaged()) {
                const heading = SimVar.GetSimVarValue("GPS COURSE TO STEER", "degree", "FMC");
                if (isFinite(heading)) {
                    Coherent.call("HEADING_BUG_SET", 2, heading);
                }
            }
        }
        if (this.updateAutopilotCooldown < 0) {
            const currentApMasterStatus = SimVar.GetSimVarValue("AUTOPILOT MASTER", "boolean");
            if (currentApMasterStatus != this._apMasterStatus) {
                this._apMasterStatus = currentApMasterStatus;
                apLogicOn = (this._apMasterStatus || Simplane.getAutoPilotFlightDirectorActive(1));
                this._forceNextAltitudeUpdate = true;
                console.log("Enforce AP in Altitude Lock mode. Cause : AP Master Status has changed.");
                SimVar.SetSimVarValue("L:A320_NEO_FCU_FORCE_IDLE_VS", "Number", 1);
                if (this._apMasterStatus) {
                    if (this.flightPlanManager.getWaypointsCount() === 0) {
                        this._onModeSelectedAltitude();
                        this._onModeSelectedHeading();
                        this._onModeSelectedSpeed();
                    }
                }
            }
            if (apLogicOn) {
                if (!Simplane.getAutoPilotFLCActive() && !SimVar.GetSimVarValue("AUTOPILOT AIRSPEED HOLD", "Boolean")) {
                    SimVar.SetSimVarValue("K:AP_PANEL_SPEED_HOLD", "Number", 1);
                }
                if (!SimVar.GetSimVarValue("AUTOPILOT HEADING LOCK", "Boolean")) {
                    if (!SimVar.GetSimVarValue("AUTOPILOT APPROACH HOLD", "Boolean")) {
                        SimVar.SetSimVarValue("K:AP_PANEL_HEADING_HOLD", "Number", 1);
                    }
                }
            }
            const currentHasReachedFlex = Simplane.getEngineThrottleMode(0) >= ThrottleMode.FLEX_MCT && Simplane.getEngineThrottleMode(1) >= ThrottleMode.FLEX_MCT;
            if (currentHasReachedFlex != this._lastHasReachFlex) {
                this._lastHasReachFlex = currentHasReachedFlex;
                console.log("Current Has Reached Flex = " + currentHasReachedFlex);
                if (currentHasReachedFlex) {
                    if (!SimVar.GetSimVarValue("AUTOPILOT THROTTLE ARM", "boolean")) {
                        SimVar.SetSimVarValue("K:AUTO_THROTTLE_ARM", "number", 1);
                    }
                }
            }
            const currentAltitude = Simplane.getAltitude();
            const groundSpeed = Simplane.getGroundSpeed();
            const planeCoordinates = new LatLong(SimVar.GetSimVarValue("PLANE LATITUDE", "degree latitude"), SimVar.GetSimVarValue("PLANE LONGITUDE", "degree longitude"));
            
            SimVar.SetSimVarValue("SIMVAR_AUTOPILOT_AIRSPEED_MIN_CALCULATED", "knots", Simplane.getStallProtectionMinSpeed());
            SimVar.SetSimVarValue("SIMVAR_AUTOPILOT_AIRSPEED_MAX_CALCULATED", "knots", Simplane.getMaxSpeed(Aircraft.A320_NEO));
            if (this.isAltitudeManaged()) {
                const prevWaypoint = this.flightPlanManager.getPreviousActiveWaypoint();
                const nextWaypoint = this.flightPlanManager.getActiveWaypoint();
                if (prevWaypoint && nextWaypoint) {
                    const selectedAltitude = Simplane.getAutoPilotSelectedAltitudeLockValue("feet");
                    if (!this.flightPlanManager.getIsDirectTo() &&
                        isFinite(nextWaypoint.legAltitude1) &&
                        nextWaypoint.legAltitude1 < 20000 &&
                        nextWaypoint.legAltitude1 > selectedAltitude) {
                        Coherent.call("AP_ALT_VAR_SET_ENGLISH", 2, nextWaypoint.legAltitude1, this._forceNextAltitudeUpdate);
                        this._forceNextAltitudeUpdate = false;
                        SimVar.SetSimVarValue("L:AP_CURRENT_TARGET_ALTITUDE_IS_CONSTRAINT", "number", 1);
                    } else {
                        const altitude = Simplane.getAutoPilotSelectedAltitudeLockValue("feet");
                        if (isFinite(altitude)) {
                            Coherent.call("AP_ALT_VAR_SET_ENGLISH", 2, altitude, this._forceNextAltitudeUpdate);
                            this._forceNextAltitudeUpdate = false;
                            SimVar.SetSimVarValue("L:AP_CURRENT_TARGET_ALTITUDE_IS_CONSTRAINT", "number", 0);
                        }
                    }
                } else {
                    const altitude = Simplane.getAutoPilotSelectedAltitudeLockValue("feet");
                    if (isFinite(altitude)) {
                        Coherent.call("AP_ALT_VAR_SET_ENGLISH", 2, altitude, this._forceNextAltitudeUpdate);
                        this._forceNextAltitudeUpdate = false;
                        SimVar.SetSimVarValue("L:AP_CURRENT_TARGET_ALTITUDE_IS_CONSTRAINT", "number", 0);
                    }
                }
            }
            if (!this.flightPlanManager.isActiveApproach()) {
                const activeWaypoint = this.flightPlanManager.getActiveWaypoint();
                const nextActiveWaypoint = this.flightPlanManager.getNextActiveWaypoint();
                if (activeWaypoint && nextActiveWaypoint) {
                    let pathAngle = nextActiveWaypoint.bearingInFP - activeWaypoint.bearingInFP;
                    while (pathAngle < 180) {
                        pathAngle += 360;
                    }
                    while (pathAngle > 180) {
                        pathAngle -= 360;
                    }
                    const absPathAngle = 180 - Math.abs(pathAngle);
                    const airspeed = Simplane.getIndicatedSpeed();
                    if (airspeed < 400) {
                        const turnRadius = airspeed * 360 / (1091 * 0.36 / airspeed) / 3600 / 2 / Math.PI;
                        const activateDistance = Math.pow(90 / absPathAngle, 1.6) * turnRadius * 1.2;
                        ;
                        const distanceToActive = Avionics.Utils.computeGreatCircleDistance(planeCoordinates, activeWaypoint.infos.coordinates);
                        if (distanceToActive < activateDistance) {
                            this.flightPlanManager.setActiveWaypointIndex(this.flightPlanManager.getActiveWaypointIndex() + 1);
                        }
                    }
                }
            }
            if (Simplane.getAutoPilotAltitudeManaged() && SimVar.GetSimVarValue("L:A320_NEO_FCU_STATE", "number") != 1) {
                const currentWaypointIndex = this.flightPlanManager.getActiveWaypointIndex();
                if (currentWaypointIndex != this._lastRequestedFLCModeWaypointIndex) {
                    this._lastRequestedFLCModeWaypointIndex = currentWaypointIndex;
                    setTimeout(() => {
                        if (Simplane.getAutoPilotAltitudeManaged()) {
                            this._onModeManagedAltitude();
                        }
                    }, 1000);
                }
            }
            if (this.currentFlightPhase === FlightPhase.FLIGHT_PHASE_TAKEOFF) {
                const n1 = this.getThrustTakeOffLimit() / 100;
                SimVar.SetSimVarValue("AUTOPILOT THROTTLE MAX THRUST", "number", n1);
                if (this.isAirspeedManaged()) {
                    // getCleanTakeOffSpeed is a final fallback and not truth to reality
                    const speed = isFinite(this.v2Speed) ? this.v2Speed + 10 : this.getCleanTakeOffSpeed();
                    this.setAPManagedSpeed(speed, Aircraft.A320_NEO);
                }

                //This breaks everything, not sure why (from 1.8.3 update)
                /* let altitude = Simplane.getAltitudeAboveGround();
                let n1 = 100;
                if (altitude < this.thrustReductionAltitude) {
                    n1 = this.getThrustTakeOffLimit() / 100;
                }
                else {
                    n1 = this.getThrustClimbLimit() / 100;
                }
                SimVar.SetSimVarValue("AUTOPILOT THROTTLE MAX THRUST", "number", n1); */

            } else if (this.currentFlightPhase === FlightPhase.FLIGHT_PHASE_CLIMB) {
                if (this.isAirspeedManaged()) {
                    const speed = this.getClbManagedSpeed();
                    this.setAPManagedSpeed(speed, Aircraft.A320_NEO);
                }
            } else if (this.currentFlightPhase === FlightPhase.FLIGHT_PHASE_CRUISE) {
                if (this.isAirspeedManaged()) {
                    const speed = this.getCrzManagedSpeed();
                    this.setAPManagedSpeed(speed, Aircraft.A320_NEO);
                }
                if (this.isAltitudeManaged()) {
                }
                /* let altitude = Simplane.getAltitudeAboveGround();
                let n1 = 100;
                if (altitude < this.thrustReductionAltitude) {
                    n1 = this.getThrustTakeOffLimit() / 100;
                }
                else {
                    n1 = this.getThrustClimbLimit() / 100;
                }
                SimVar.SetSimVarValue("AUTOPILOT THROTTLE MAX THRUST", "number", n1); */
            } else if (this.currentFlightPhase === FlightPhase.FLIGHT_PHASE_DESCENT) {
                if (this.isAirspeedManaged()) {
                    const speed = this.getDesManagedSpeed();
                    this.setAPManagedSpeed(speed, Aircraft.A320_NEO);
                }
            } else if (this.currentFlightPhase === FlightPhase.FLIGHT_PHASE_APPROACH) {
                if (this.isAirspeedManaged()) {
                    const speed = this.getManagedApproachSpeedMcdu();
                    this.setAPManagedSpeed(speed, Aircraft.A320_NEO);
                }
            }
            this.updateAutopilotCooldown = this._apCooldown;
        }
    }
    // Asobo's getManagedApproachSpeed uses incorrect getCleanApproachSpeed for flaps 0
    getManagedApproachSpeedMcdu() {
        const flapsHandleIndex = Simplane.getFlapsHandleIndex();
        if (flapsHandleIndex === 0) {
            return this.getPerfGreenDotSpeed();
        } else if (flapsHandleIndex === 1) {
            return this.getSlatApproachSpeed();
        } else if (flapsHandleIndex === 2) {
            return this.getFlapApproachSpeed();
        } else {
            return this.getVApp();
        }
    }
    checkUpdateFlightPhase() {
        const airSpeed = SimVar.GetSimVarValue("AIRSPEED TRUE", "knots");
        const leftThrottleDetent = Simplane.getEngineThrottleMode(0);
        const rightThrottleDetent = Simplane.getEngineThrottleMode(1);
        const highestThrottleDetent = (leftThrottleDetent >= rightThrottleDetent) ? leftThrottleDetent : rightThrottleDetent;

        //End preflight when takeoff power is applied and engines are running
        if (this.currentFlightPhase <= 2) {
            if ((highestThrottleDetent == ThrottleMode.TOGA || highestThrottleDetent == ThrottleMode.FLEX_MCT) && SimVar.GetSimVarValue("ENG N1 RPM:1", "Percent") > 15 && SimVar.GetSimVarValue("ENG N1 RPM:2", "Percent") > 15) {
                SimVar.SetSimVarValue("L:A32NX_Preflight_Complete", "Bool", 1);
            }
        }

        //Reset to preflight in case of RTO
        if (this.currentFlightPhase <= 2 && SimVar.GetSimVarValue("L:A32NX_Preflight_Complete", "Bool") == 1) {
            if (!(highestThrottleDetent == ThrottleMode.TOGA || highestThrottleDetent == ThrottleMode.FLEX_MCT) && SimVar.GetSimVarValue("RADIO HEIGHT", "Feet") < 100) {
                SimVar.SetSimVarValue("L:A32NX_Preflight_Complete", "Bool", 0);
                this.climbTransitionGroundAltitude = null;
            }
        }
        //Changes to climb phase when acceleration altitude is reached
        if (this.currentFlightPhase === FlightPhase.FLIGHT_PHASE_TAKEOFF && airSpeed > 80) {
            const planeAltitudeMsl = Simplane.getAltitude();
            let accelerationAltitudeMsl = (this.accelerationAltitude || this.thrustReductionAltitude);

            if (!accelerationAltitudeMsl) {
                if (!this.climbTransitionGroundAltitude) {
                    const origin = this.flightPlanManager.getOrigin();
                    if (origin) {
                        this.climbTransitionGroundAltitude = origin.altitudeinFP;
                    }

                    if (!this.climbTransitionGroundAltitude) {
                        this.climbTransitionGroundAltitude = (parseInt(SimVar.GetSimVarValue("GROUND ALTITUDE", "feet")) || 0);
                    }
                }

                accelerationAltitudeMsl = this.climbTransitionGroundAltitude + 1500;
            }

            if (planeAltitudeMsl > accelerationAltitudeMsl) {
                console.log('switching to FLIGHT_PHASE_CLIMB: ' + JSON.stringify({planeAltitudeMsl, accelerationAltitudeMsl, prevPhase: this.currentFlightPhase}, null, 2));
                this.currentFlightPhase = FlightPhase.FLIGHT_PHASE_CLIMB;
                this.climbTransitionGroundAltitude = null;
            }
        }
        //Default Asobo logic
        if (this.currentFlightPhase === FlightPhase.FLIGHT_PHASE_CLIMB) {
            const altitude = SimVar.GetSimVarValue("PLANE ALTITUDE", "feets");
            const cruiseFlightLevel = this.cruiseFlightLevel * 100;
            if (isFinite(cruiseFlightLevel)) {
                if (altitude >= 0.96 * cruiseFlightLevel) {
                    console.log('switching to FLIGHT_PHASE_CRUISE: ' + JSON.stringify({altitude, cruiseFlightLevel, prevPhase: this.currentFlightPhase}, null, 2));
                    this.currentFlightPhase = FlightPhase.FLIGHT_PHASE_CRUISE;
                    Coherent.call("GENERAL_ENG_THROTTLE_MANAGED_MODE_SET", ThrottleMode.AUTO);
                }
            }
        }
        //(Mostly) Default Asobo logic
        if (this.currentFlightPhase === FlightPhase.FLIGHT_PHASE_CRUISE) {
            const altitude = SimVar.GetSimVarValue("PLANE ALTITUDE", "feets");
            const cruiseFlightLevel = this.cruiseFlightLevel * 100;
            if (isFinite(cruiseFlightLevel)) {
                if (altitude < 0.94 * cruiseFlightLevel) {
                    console.log('switching to FLIGHT_PHASE_DESCENT: ' + JSON.stringify({altitude, cruiseFlightLevel, prevPhase: this.currentFlightPhase}, null, 2));
                    this.currentFlightPhase = FlightPhase.FLIGHT_PHASE_DESCENT;
                    Coherent.call("GENERAL_ENG_THROTTLE_MANAGED_MODE_SET", ThrottleMode.AUTO);
                }
            }
        }
        //Default Asobo logic
        // Switches from any phase to APPR if less than 40 distance(?) from DEST
        if (this.flightPlanManager.getActiveWaypoint() === this.flightPlanManager.getDestination()) {
            if (SimVar.GetSimVarValue("L:FLIGHTPLAN_USE_DECEL_WAYPOINT", "number") != 1) {
                const lat = SimVar.GetSimVarValue("PLANE LATITUDE", "degree latitude");
                const long = SimVar.GetSimVarValue("PLANE LONGITUDE", "degree longitude");
                const planeLla = new LatLongAlt(lat, long);
                const dist = Avionics.Utils.computeGreatCircleDistance(planeLla, this.flightPlanManager.getDestination().infos.coordinates);
                if (dist < 40) {
                    this.connectIls();
                    this.flightPlanManager.activateApproach();
                    if (this.currentFlightPhase != FlightPhase.FLIGHT_PHASE_APPROACH) {
                        console.log('switching to tryGoInApproachPhase: ' + JSON.stringify({lat, long, dist, prevPhase: this.currentFlightPhase}, null, 2));
                        this.tryGoInApproachPhase();
                    }
                }
            }
        }
        //Default Asobo logic
        // Switches from any phase to APPR if less than 3 distance(?) from DECEL
        if (SimVar.GetSimVarValue("L:FLIGHTPLAN_USE_DECEL_WAYPOINT", "number") === 1) {
            if (this.currentFlightPhase != FlightPhase.FLIGHT_PHASE_APPROACH) {
                if (this.flightPlanManager.decelWaypoint) {
                    const lat = SimVar.GetSimVarValue("PLANE LATITUDE", "degree latitude");
                    const long = SimVar.GetSimVarValue("PLANE LONGITUDE", "degree longitude");
                    const planeLla = new LatLongAlt(lat, long);
                    const dist = Avionics.Utils.computeGreatCircleDistance(this.flightPlanManager.decelWaypoint.infos.coordinates, planeLla);
                    if (dist < 3) {
                        console.log('switching to tryGoInApproachPhase (AT DECEL): ' + JSON.stringify({lat, long, dist, prevPhase: this.currentFlightPhase}, null, 2));
                        console.log("Switching into approach. DECEL lat : " + lat + " long " + long);
                        this.tryGoInApproachPhase();
                    }
                }
            }
        }
        //Resets flight phase to preflight 30 seconds after touchdown
        if (this.currentFlightPhase === FlightPhase.FLIGHT_PHASE_APPROACH && Simplane.getAltitudeAboveGround() < 1.5) {
            if (this.landingResetTimer == null) {
                this.landingResetTimer = 30;
            }
            if (this.lastPhaseUpdateTime == null) {
                this.lastPhaseUpdateTime = Date.now();
            }
            const deltaTime = Date.now() - this.lastPhaseUpdateTime;
            this.lastPhaseUpdateTime = Date.now();
            this.landingResetTimer -= deltaTime / 1000;
            if (this.landingResetTimer <= 0) {
                this.landingResetTimer = null;
                this.currentFlightPhase = 2;
                SimVar.SetSimVarValue("L:A32NX_Preflight_Complete", "Bool", 0);
                SimVar.SetSimVarValue("L:A32NX_TO_CONFIG_NORMAL", "Bool", 0);
                CDUIdentPage.ShowPage(this);
            }
        } else {
            //Reset timer to 30 when airborne in case of go around
            this.landingResetTimer = 30;
        }

        if (SimVar.GetSimVarValue("L:AIRLINER_FLIGHT_PHASE", "number") != this.currentFlightPhase) {
            SimVar.SetSimVarValue("L:AIRLINER_FLIGHT_PHASE", "number", this.currentFlightPhase);
            this.onFlightPhaseChanged();
            SimVar.SetSimVarValue("L:A32NX_CABIN_READY", "Bool", 0);
        }
    }
}
A320_Neo_CDU_MainDisplay._v1sConf1 = [
    [145, 149],
    [143, 151],
    [141, 152],
    [139, 150],
    [137, 147],
    [136, 145],
    [134, 143],
    [134, 142],
    [133, 142],
    [133, 143],
    [133, 144],
    [132, 145],
    [132, 146],
    [132, 146],
    [132, 147],
    [131, 148],
    [131, 148],
    [131, 149],
    [130, 150],
    [130, 150],
];
A320_Neo_CDU_MainDisplay._v1sConf2 = [
    [130, 156],
    [128, 154],
    [127, 151],
    [125, 149],
    [123, 147],
    [122, 145],
    [121, 143],
    [120, 143],
    [120, 143],
    [120, 142],
    [119, 142],
    [119, 142],
    [119, 142],
    [119, 141],
    [118, 141],
    [118, 141],
    [118, 140],
    [118, 140],
    [117, 140],
    [117, 140],
];
A320_Neo_CDU_MainDisplay._vRsConf1 = [
    [146, 160],
    [144, 160],
    [143, 159],
    [141, 158],
    [139, 156],
    [137, 154],
    [136, 152],
    [135, 151],
    [135, 151],
    [134, 151],
    [134, 151],
    [133, 151],
    [133, 151],
    [132, 150],
    [132, 151],
    [131, 151],
    [131, 150],
    [131, 150],
    [130, 151],
    [130, 150],
];
A320_Neo_CDU_MainDisplay._vRsConf2 = [
    [130, 158],
    [128, 156],
    [127, 154],
    [125, 152],
    [123, 150],
    [122, 148],
    [121, 147],
    [120, 146],
    [120, 146],
    [120, 145],
    [119, 145],
    [119, 144],
    [119, 144],
    [119, 143],
    [118, 143],
    [118, 142],
    [118, 142],
    [118, 141],
    [117, 141],
    [117, 140],
];
A320_Neo_CDU_MainDisplay._v2sConf1 = [
    [152, 165],
    [150, 165],
    [148, 164],
    [146, 163],
    [144, 161],
    [143, 159],
    [141, 157],
    [140, 156],
    [140, 156],
    [139, 156],
    [139, 155],
    [138, 155],
    [138, 155],
    [137, 155],
    [137, 155],
    [136, 155],
    [136, 155],
    [136, 155],
    [135, 155],
    [135, 155],
];
A320_Neo_CDU_MainDisplay._v2sConf2 = [
    [135, 163],
    [133, 160],
    [132, 158],
    [130, 157],
    [129, 155],
    [127, 153],
    [127, 151],
    [126, 150],
    [125, 150],
    [125, 149],
    [124, 149],
    [124, 148],
    [124, 148],
    [123, 147],
    [123, 146],
    [123, 146],
    [123, 145],
    [122, 145],
    [122, 144],
    [121, 144],
];
registerInstrument("a320-neo-cdu-main-display", A320_Neo_CDU_MainDisplay);
//# sourceMappingURL=A320_Neo_CDU_MainDisplay.js.map