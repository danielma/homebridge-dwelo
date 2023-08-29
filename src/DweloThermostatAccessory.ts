import {
  AccessoryPlugin,
  API,
  Logging,
  Service,
} from 'homebridge';

import { DweloAPI } from './DweloAPI';

function fahrenheitToCelcius(f: number) {
  return (f - 32) / 1.8
}

function formatTemperature({ unit, value}: { unit: 'F' | 'C'; value: number }) {
  if (unit === 'C') {
    return value
  } else {
    return fahrenheitToCelcius(value)
  }
}

export class DweloThermostatAccessory implements AccessoryPlugin {
  name: string;

  private readonly log: Logging;
  private readonly service: Service;

  constructor(log: Logging, api: API, dweloAPI: DweloAPI, name: string, deviceId: number) {
    this.log = log;
    this.name = name;

    this.service = new api.hap.Service.Thermostat(this.name);
    this.service.getCharacteristic(api.hap.Characteristic.CurrentHeatingCoolingState)
      .onGet(async () => {
        const { THERMOSTATS } = await dweloAPI.mobileDevices()
        const thermostat = THERMOSTATS.find(l => l.device_id === deviceId)

        if (!thermostat) {
          return api.hap.Characteristic.CurrentHeatingCoolingState.OFF
        }


        const { sensors: { ThermostatOperatingState} } = thermostat

        return ThermostatOperatingState === 'Idle' ? api.hap.Characteristic.CurrentHeatingCoolingState.OFF : api.hap.Characteristic.CurrentHeatingCoolingState.COOL
      })

    this.service.getCharacteristic(api.hap.Characteristic.TargetHeatingCoolingState)
      .onGet(async () => {
        const { THERMOSTATS } = await dweloAPI.mobileDevices()
        const thermostat = THERMOSTATS.find(l => l.device_id === deviceId)

        if (!thermostat) {
          return api.hap.Characteristic.CurrentHeatingCoolingState.OFF
        }

        const modeMap: Record<typeof thermostat['sensors']['ThermostatMode'], number> = {
          'Auto': api.hap.Characteristic.TargetHeatingCoolingState.AUTO,
          'Cool': api.hap.Characteristic.TargetHeatingCoolingState.COOL,
          'Heat': api.hap.Characteristic.TargetHeatingCoolingState.HEAT,
          'Off': api.hap.Characteristic.TargetHeatingCoolingState.OFF
        }

        return modeMap[thermostat.sensors.ThermostatMode]
      })
      .onSet(async value => {
        await dweloAPI.setThermostatMode(deviceId, value as any)
      });

    this.service.getCharacteristic(api.hap.Characteristic.CurrentTemperature)
      .onGet(async () => {
        const { THERMOSTATS } = await dweloAPI.mobileDevices()
        const thermostat = THERMOSTATS.find(l => l.device_id === deviceId)

        if (!thermostat) {
          return 0
        }

        const { sensors: { Temperature } } = thermostat

        return formatTemperature(Temperature)
      })

    this.service.getCharacteristic(api.hap.Characteristic.TargetTemperature)
      .onGet(async () => {
        const { THERMOSTATS } = await dweloAPI.mobileDevices()
        const thermostat = THERMOSTATS.find(l => l.device_id === deviceId)

        if (!thermostat) {
          return 0
        }

        const { sensors: { ThermostatCoolSetpoint, ThermostatHeatSetpoint, ThermostatMode , Temperature} } = thermostat

        switch (ThermostatMode) {
        case 'Cool':
          return formatTemperature(ThermostatCoolSetpoint)
        case 'Heat':
          return formatTemperature(ThermostatHeatSetpoint)
        case 'Auto':
          if (Temperature.value < ThermostatHeatSetpoint.value) {
            return formatTemperature(ThermostatHeatSetpoint)
          } else {
            return formatTemperature(ThermostatCoolSetpoint)
          }
        case 'Off':
          return formatTemperature(Temperature)
        }
      })

    this.service.getCharacteristic(api.hap.Characteristic.TemperatureDisplayUnits)
      .onGet(async () => {
        const characteristic = api.hap.Characteristic.TemperatureDisplayUnits
        const { THERMOSTATS } = await dweloAPI.mobileDevices()
        const thermostat = THERMOSTATS.find(l => l.device_id === deviceId)

        return thermostat?.sensors.Temperature.unit === 'C' ? characteristic.CELSIUS : characteristic.FAHRENHEIT
      })

    log.info(`Dwelo Term '${name} ' created!`);
  }

  identify(): void {
    this.log('Identify!');
  }

  getServices(): Service[] {
    return [this.service];
  }
}
