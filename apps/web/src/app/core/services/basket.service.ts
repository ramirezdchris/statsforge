import { Injectable, signal } from '@angular/core';
import { BasketItem } from '../models/football.models';

const BASKET_KEY = 'statsforge.basket';

@Injectable({ providedIn: 'root' })
export class BasketService {
  private readonly itemsSignal = signal<BasketItem[]>(this.readItems());

  readonly items = this.itemsSignal.asReadonly();

  add(item: BasketItem) {
    const exists = this.itemsSignal().some((current) => current.fixtureId === item.fixtureId);

    if (exists) {
      return;
    }

    this.setItems([...this.itemsSignal(), item]);
  }

  update(fixtureId: number, patch: Partial<BasketItem>) {
    this.setItems(
      this.itemsSignal().map((item) =>
        item.fixtureId === fixtureId ? { ...item, ...patch } : item,
      ),
    );
  }

  remove(fixtureId: number) {
    this.setItems(this.itemsSignal().filter((item) => item.fixtureId !== fixtureId));
  }

  clear() {
    this.setItems([]);
  }

  private setItems(items: BasketItem[]) {
    this.itemsSignal.set(items);
    localStorage.setItem(BASKET_KEY, JSON.stringify(items));
  }

  private readItems(): BasketItem[] {
    const raw = localStorage.getItem(BASKET_KEY);

    if (!raw) {
      return [];
    }

    try {
      return JSON.parse(raw) as BasketItem[];
    } catch {
      localStorage.removeItem(BASKET_KEY);
      return [];
    }
  }
}
