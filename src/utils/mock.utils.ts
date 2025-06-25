export function setBaseMockStatic<T>() {
  return <U extends T>(constructor: U) => {constructor};
}