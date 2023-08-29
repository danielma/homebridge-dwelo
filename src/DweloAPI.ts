
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';


interface ListResponse {
  resultsCount: number;
  totalCount: number;
}

export interface Device {
  addressId: number;
  dateRegistered: string;
  deviceType: 'lock' | 'switch' | 'dimmer' | 'thermostat';
  device_metadata: Record<string, string>;
  gatewayId: string;
  givenName: string;
  isActive: boolean;
  isOnline: boolean;
  leasee: number;
  localId: string;
  metadata_id: string;
  uid: number;
}

interface ListDevicesResponse extends ListResponse {
  results: Device[];
}

export interface Sensor {
  deviceId: number;
  gatewayId: number;
  sensorType: string;
  timeIssued: string;
  uid: number;
  value: string;
}

interface ListSensorsResponse extends ListResponse {
  results: Sensor[];
}

type MobileLight = {
  device_id: number
  sensors: {
    Percent?: number
    Switch: 'On' | 'Off'
  }
}

type MobileThermostat = {
  device_id: number
  sensors: {
    Humidity: number
    Temperature: {
      unit: 'F' | 'C'
      value: number
    }
    ThermostatCoolSetpoint: {
      unit: 'F' | 'C'
      value: number
    }
    ThermostatFanMode: 'AutoLow' | 'ManualLow'
    ThermostatHeatSetpoint: {
      unit: 'F' | 'C'
      value: number
    }
    ThermostatMode: 'Auto' | 'Heat' | 'Cool' | 'Off'
    ThermostatOperatingState: 'Idle'
  }
}

type MobileDevices = {
  GATEWAY: object
  "LIGHTS AND SWITCHES": MobileLight[]
  "THERMOSTATS": MobileThermostat[]
}

export class DweloAPI {
  constructor(private readonly token: string, private readonly gatewayID: string) { }

  public async devices(): Promise<Device[]> {
    const response = await this.request<ListDevicesResponse>('/v3/device', {
      params: {
        gatewayId: this.gatewayID,
        limit: 5000,
        offset: 0,
      },
    });
    return response.data.results;
  }

  public async sensors(deviceId: number): Promise<Sensor[]> {
    const response = await this.request<ListSensorsResponse>(`/v3/sensor/gateway/${this.gatewayID}/`, {
      params: {
        deviceId,
      },
    });
    return response.data.results;
  }

  public async mobileDevices(): Promise<MobileDevices> {
    const response = await this.request<MobileDevices>(`/mobile/v1/devices/${this.gatewayID}/`)

    return response.data
  }

  public async toggleSwitch(on: boolean, id: number) {
    return this.request(`/v3/device/${id}/command/`, {
      method: 'POST',
      data: { 'command': on ? 'on' : 'off' },
    });
  }

  public async setDimmer(id: number, percent: number) {
    return this.request(`/v3/device/${id}/command/`, {
      method: 'POST',
      data: { 'command': 'Multilevel On', 'commandValue': percent.toString() },
    });
  }

  public async setThermostatMode(id: number, mode: MobileThermostat['sensors']['ThermostatMode']) {
    return this.request(`/v3/device/${id}/command/`, {
      method: 'POST',
      data: { command: mode.toLocaleLowerCase() }
    })
  }

  public async toggleLock(locked: boolean, id: number) {
    await this.request(`/v3/device/${id}/command/`, {
      method: 'POST',
      data: { 'command': locked ? 'lock' : 'unlock' },
    });

    const target = locked ? 'locked' : 'unlocked';
    await poll({
      requestFn: () => this.sensors(id),
      stopCondition: s => s.find(s => s.sensorType === 'lock')?.value === target,
      interval: 5000,
      timeout: 60 * 1000,
    });
  }

  private async request<T>(
    path: string,
    { headers, method, data, params }: AxiosRequestConfig<T> = {},
  ): Promise<AxiosResponse<T>> {
    const response = await axios({
      url: 'https://api.dwelo.com' + path,
      method: method ?? 'GET',
      params,
      data,
      headers: {
        ...headers,
        Authorization: `Token ${this.token} `,
      },
    });
    return response;
  }
}

function poll<T>({ requestFn, stopCondition, interval, timeout }: {
  requestFn: () => Promise<T>;
  stopCondition: (response: T) => boolean;
  interval: number;
  timeout: number;
}): Promise<T> {
  let stop = false;

  const executePoll = async (resolve: (r: T) => unknown, reject: (e: Error) => void) => {
    const result = await requestFn();

    let stopConditionalResult: boolean;
    try {
      stopConditionalResult = stopCondition(result);
    } catch (e) {
      reject(e as Error);
      return;
    }

    if (stopConditionalResult) {
      resolve(result);
    } else if (stop) {
      reject(new Error('timeout'));
    } else {
      setTimeout(executePoll, interval, resolve, reject);
    }
  };

  const pollResult = new Promise<T>(executePoll);
  const maxTimeout = new Promise<T>((_, reject) => {
    setTimeout(() => {
      reject(new Error('Exceeded max timeout'));
      stop = true;
    }, timeout);
  });

  return Promise.race([pollResult, maxTimeout]);
}
