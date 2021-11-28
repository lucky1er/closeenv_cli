import { browser, by, element } from 'protractor';

export class AppPage {
  navigateTo(): Promise<unknown> {
    return browser.get(browser.baseUrl) as Promise<unknown>;
  }

  getNavbarEntry(indexEntry: number): Promise<string> {
    const locator = by.css('app-root header li.nav-item');
    return element.all(locator).get(indexEntry).element(by.css('a')).getText() as Promise<string>;
  }
}
