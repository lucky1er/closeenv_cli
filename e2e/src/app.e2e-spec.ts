import { AppPage } from './app.po';
import { browser, logging } from 'protractor';

describe('workspace-project App', () => {
  let page: AppPage;

  beforeEach(() => {
    page = new AppPage();
  });

  it('the navigation bar should offer all expected menu options', () => {
    page.navigateTo();
    expect(page.getNavbarEntry(0)).toContain('Accueil');
    expect(page.getNavbarEntry(1)).toContain('A propos');
    expect(page.getNavbarEntry(2)).toContain('Contact');
    expect(page.getNavbarEntry(3)).toContain('Se connecter');
    expect(page.getNavbarEntry(4)).toContain('Me relocaliser');
  });

  afterEach(async () => {
    // Assert that there are no errors emitted from the browser
    const logs = await browser.manage().logs().get(logging.Type.BROWSER);
    expect(logs).not.toContain(jasmine.objectContaining({
      level: logging.Level.SEVERE,
    } as logging.Entry));
  });
});
