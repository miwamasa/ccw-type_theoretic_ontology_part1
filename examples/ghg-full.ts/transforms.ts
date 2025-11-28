// Auto-generated transform functions

import * as Types from './types';

export function FactoryProductionDataToGHGEmissionsReport(source: Types.FactoryProductionData): Types.GHGEmissionsReport {
  const result: any = {};

  const _t0 = source.factoryId;
  result.facilityIdentifier = _t0;
  result.calculationMethodology = "GHG Protocol - Emission factors: electricity 0.5 kgCO2e/kWh, natural gas 2.0 kgCO2e/m3, diesel 2.7 kgCO2e/L";
  result.verified = false;
  const _t1 = source.naturalGasUsage;
  const _t2 = Types.multiplyValue(_t1, 2);
  const _t3 = Types.divideValue(_t2, 1000);
  result.scope1NaturalGas = _t3;
  const _t4 = source.dieselFuelUsage;
  const _t5 = Types.multiplyValue(_t4, 2.7);
  const _t6 = Types.divideValue(_t5, 1000);
  result.scope1DieselCombustion = _t6;
  const _t7 = source.naturalGasUsage;
  const _t8 = Types.multiplyValue(_t7, 2);
  const _t9 = Types.divideValue(_t8, 1000);
  const _t10 = source.dieselFuelUsage;
  const _t11 = Types.multiplyValue(_t10, 2.7);
  const _t12 = Types.divideValue(_t11, 1000);
  const _t13 = Types.addValue(_t9, _t12);
  result.scope1DirectEmissions = _t13;
  const _t14 = source.electricityUsage;
  const _t15 = Types.multiplyValue(_t14, 0.5);
  const _t16 = Types.divideValue(_t15, 1000);
  result.scope2Electricity = _t16;
  const _t17 = source.electricityUsage;
  const _t18 = Types.multiplyValue(_t17, 0.5);
  const _t19 = Types.divideValue(_t18, 1000);
  result.scope2IndirectEmissions = _t19;
  const _t20 = source.electricityUsage;
  const _t21 = Types.multiplyValue(_t20, 0.5);
  const _t22 = Types.divideValue(_t21, 1000);
  const _t23 = source.naturalGasUsage;
  const _t24 = Types.multiplyValue(_t23, 2);
  const _t25 = Types.divideValue(_t24, 1000);
  const _t26 = Types.addValue(_t22, _t25);
  const _t27 = source.dieselFuelUsage;
  const _t28 = Types.multiplyValue(_t27, 2.7);
  const _t29 = Types.divideValue(_t28, 1000);
  const _t30 = Types.addValue(_t26, _t29);
  result.totalEmissions = _t30;
  result.emissionsPerUnit = null;
  result.emissionsPerHour = null;

  return result;
}
