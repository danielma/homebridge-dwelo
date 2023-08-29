import { AccessoryPlugin, API, Logging, Service } from 'homebridge';

import { DweloAPI } from './DweloAPI';

export class DweloDimmerAccessory implements AccessoryPlugin {
  name: string;

  private readonly log: Logging;
  private readonly service: Service;

  constructor(
    log: Logging,
    api: API,
    dweloAPI: DweloAPI,
    name: string,
    switchID: number,
  ) {
    this.log = log;
    this.name = name;

    this.service = new api.hap.Service.Lightbulb(this.name);
    this.service
      .getCharacteristic(api.hap.Characteristic.On)
      .onGet(async () => {
        const { 'LIGHTS AND SWITCHES': lights } =
          await dweloAPI.mobileDevices();
        const light = lights.find((l) => l.device_id === switchID);
        const isOn = light?.sensors.Switch === 'On';
        log.debug(
          `Current state of switch ${switchID} was returned: ${
            isOn ? 'ON' : 'OFF'
          }`,
        );
        return isOn;
      })
      .onSet(async (value) => {
        await dweloAPI.toggleSwitch(value as boolean, switchID);
        log.debug(`Switch state was set to: ${value ? 'ON' : 'OFF'}`);
      });

    this.service
      .getCharacteristic(api.hap.Characteristic.Brightness)
      .onGet(async () => {
        const { 'LIGHTS AND SWITCHES': lights } =
          await dweloAPI.mobileDevices();
        const light = lights.find((l) => l.device_id === switchID);
        const percent = light?.sensors.Percent || 0;

        return percent > 98 ? 100 : percent;
      })
      .onSet(async (value) => {
        await dweloAPI.setDimmer(switchID, value as number);
        log.debug(`Switch dimmer was set to: ${value}`);
      });

    log.info(`Dwelo Switch '${name} ' created!`);
  }

  identify(): void {
    this.log('Identify!');
  }

  getServices(): Service[] {
    return [this.service];
  }
}
