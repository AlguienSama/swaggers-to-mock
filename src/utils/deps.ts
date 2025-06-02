type Constructor<T> = new (...args: any[]) => T;

export default class Deps {
  static deps = new Map<Constructor<unknown>, unknown>();

  static get<T>(type: Constructor<T>): T {
    return (this.deps.get(type) as T) ?? this.set(type, new type());
  }
  static set<T>(type: Constructor<T>, instance: T): T {
    this.deps.set(type, instance);
    return instance;
  }
}
