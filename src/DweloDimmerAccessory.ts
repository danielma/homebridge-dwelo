import {
  AccessoryPlugin,
  API,
  Logging,
  Service,
} from 'homebridge';

import { DweloAPI } from './DweloAPI';

export class DweloDimmerAccessory implements AccessoryPlugin {
  name: string;

  private readonly log: Logging;
  private readonly service: Service;

  constructor(log: Logging, api: API, dweloAPI: DweloAPI, name: string, switchID: number) {
    this.log = log;
    this.name = name;

    this.service = new api.hap.Service.Switch(this.name);
    this.service.getCharacteristic(api.hap.Characteristic.On)
      .onGet(async () => {
        const sensors = await dweloAPI.sensors(switchID);
        const isOn = sensors[0]?.value === 'on';
        log.debug(`Current state of the switch was returned: ${isOn ? 'ON' : 'OFF'}`);
        return isOn;
      })
      .onSet(async value => {
        await dweloAPI.toggleSwitch(value as boolean, switchID);
        log.debug(`Switch state was set to: ${value ? 'ON' : 'OFF'}`);
      });

    this.service.getCharacteristic(api.hap.Characteristic.Brightness)
      .onGet(async () => {
        const sensors = await dweloAPI.sensors(switchID);
        const isOn = sensors[0]?.value === 'on';
        log.debug(`Current state of the switch was returned: ${isOn ? 'ON' : 'OFF'}`);
        return isOn;
      })
      .onSet(async value => {
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
