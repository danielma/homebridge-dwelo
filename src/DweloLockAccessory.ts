import {
  AccessoryPlugin,
  API,
  CharacteristicValue,
  Logging,
  Service,
} from 'homebridge';

import { DweloAPI, Sensor } from './DweloAPI';

export class DweloLockAccessory implements AccessoryPlugin {
  private readonly lockService: Service;
  private targetState: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  constructor(
    private readonly log: Logging,
    private readonly api: API,
    private readonly dweloAPI: DweloAPI,
    public readonly name: string,
    private readonly lockID: number) {
    this.lockService = new api.hap.Service.LockMechanism(name);

    this.lockService.getCharacteristic(api.hap.Characteristic.LockCurrentState)
      .onGet(this.getLockState.bind(this));

    this.lockService.getCharacteristic(api.hap.Characteristic.LockTargetState)
      .onGet(this.getTargetLockState.bind(this))
      .onSet(this.setTargetLockState.bind(this));

    this.lockService.addOptionalCharacteristic(api.hap.Characteristic.BatteryLevel);
    this.lockService.addOptionalCharacteristic(api.hap.Characteristic.StatusLowBattery);

    log.info(`Dwelo Lock '${name} ' created!`);
  }

  identify(): void {
    this.log('Identify!');
  }

  getServices(): Service[] {
    return [this.lockService];
  }

  private async getLockState() {
    const sensors = await this.dweloAPI.sensors(this.lockID);
    const lockSensor = sensors.find(s => s.sensorType === 'lock');
    const state = lockSensor?.value === 'locked'
      ? this.api.hap.Characteristic.LockCurrentState.SECURED
      : this.api.hap.Characteristic.LockCurrentState.UNSECURED;
    this.setBatteryLevel(sensors);
    this.log.info(`Current state of the lock was returned: ${state}`);
    return state;
  }

  private async getTargetLockState() {
    return this.targetState;
  }

  private async setTargetLockState(value: CharacteristicValue) {
    this.targetState = value;
    await this.dweloAPI.toggleLock(!!value, this.lockID);
    this.log.info(`Lock state was set to: ${value}`);
  }

  private setBatteryLevel(sensors: Sensor[]) {
    const batterySensor = sensors.find(s => s.sensorType === 'battery');
    this.log.info('Lock battery percentage: ', batterySensor?.value);

    if (!batterySensor) {
      return;
    }

    const batteryLevel = parseInt(batterySensor.value, 10);
    const batteryStatus = batteryLevel > 20
      ? this.api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
      : this.api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW;

    this.lockService.setCharacteristic(this.api.hap.Characteristic.BatteryLevel, batteryLevel);
    this.lockService.setCharacteristic(this.api.hap.Characteristic.StatusLowBattery, batteryStatus);
  }
}