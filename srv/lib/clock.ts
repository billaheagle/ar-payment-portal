const systemClock = (): Date => new Date();
let clockSource = systemClock;

export const now = (): Date => {
  return clockSource();
};

export const setClock = (fn: () => Date): void => {
  clockSource = fn;
};

export const resetClock = (): void => {
  clockSource = (): Date => systemClock();
};

export const today = (): string => {
  return now().toISOString().split('T')[0];
};
