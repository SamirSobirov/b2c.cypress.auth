describe('Authentication Flow', () => {

  const EMAIL = Cypress.env('LOGIN_EMAIL');
  const PASSWORD = Cypress.env('LOGIN_PASSWORD');

  // Таймауты вынесены сюда, чтобы править их в одном месте.
  // Значения с запасом под GitHub Actions — ubuntu-раннер медленнее локалки.
  const T = {
    PAGE: 120000,   // загрузка главной (холодный старт CI)
    UI: 30000,      // появление элементов интерфейса
    API: 45000,     // ответ бэкенда на POST /login
    LOGOUT: 30000,  // закрытие модалки после успешного входа
  };

  // Паузы между шагами — видны в логе раннера как `wait N`.
  // Дают Vue/PrimeVue доиграть анимацию и перерисовать форму,
  // чтобы следующий шаг работал по устоявшемуся DOM.
  const PAUSE = {
    MODAL: 1000,  // анимация открытия модалки
    FIELD: 500,   // после ввода в поле
    SUBMIT: 800,  // перед отправкой формы
  };

  before(() => {
    // Локально креды берутся из cypress.env.json (он в .gitignore).
    // В GitHub Actions — из секретов CYPRESS_LOGIN_EMAIL / CYPRESS_LOGIN_PASSWORD.
    // Падаем сразу с понятным текстом, а не на type(undefined) внутри теста.
    expect(EMAIL, 'секрет CYPRESS_LOGIN_EMAIL не задан').to.be.a('string').and.not.be.empty;
    expect(PASSWORD, 'секрет CYPRESS_LOGIN_PASSWORD не задан').to.be.a('string').and.not.be.empty;
  });

  beforeEach(() => {
    // сбрасываем статус на каждой попытке: при retry в CI старое значение
    // от упавшего прогона не должно попасть в отчёт
    cy.writeFile('auth_api_status.txt', 'UNKNOWN');
  });

  it('Login Flow with Smart Diagnostic', () => {
    cy.viewport(1280, 800);

    // 1. ПЕРЕХВАТ API
    cy.intercept({ method: 'POST', url: '**/login**' }).as('apiAuth');

    // 2. ПЕРЕХОД НА ГЛАВНУЮ
    cy.visit('https://metatrip.asia/ru/', { timeout: T.PAGE });

    // 3. ОТКРЫТИЕ МОДАЛКИ "ВХОД В ПРОФИЛЬ"
    cy.contains('nav button', 'Войти', { timeout: T.UI })
      .should('be.visible')
      .click({ timeout: T.UI });

    cy.wait(PAUSE.MODAL); // ждём анимацию открытия модалки

    cy.get('.p-dialog', { timeout: T.UI }).should('be.visible').within(() => {
      cy.contains('Вход в профиль', { timeout: T.UI }).should('be.visible');

      // 4. ВВОД ПОЧТЫ
      cy.fillInput('input[name="email"]', EMAIL, { timeout: T.UI });
      cy.wait(PAUSE.FIELD);

      // 5. ВВОД ПАРОЛЯ
      // (cy.fillInput повторяет ввод: Vue пересоздаёт ноду после ввода почты)
      cy.fillInput('input[name="password"]', PASSWORD, { timeout: T.UI });
      cy.wait(PAUSE.SUBMIT);

      // 6. КЛИК "ВОЙТИ"
      cy.get('button[aria-label="Войти"]', { timeout: T.UI })
        .should('be.visible')
        .and('have.attr', 'data-p-disabled', 'false')
        .click({ timeout: T.UI });
    });

    // 7. УМНАЯ ПРОВЕРКА ОТВЕТА СЕРВЕРА
    cy.wait('@apiAuth', { timeout: T.API }).then((interception) => {
      const statusCode = interception.response?.statusCode || 500;
      cy.writeFile('auth_api_status.txt', statusCode.toString());

      if (statusCode >= 400) {
        throw new Error(`🆘 Ошибка сервера при авторизации: HTTP ${statusCode}`);
      }
    });

    // 8. ПРОВЕРКА УСПЕШНОГО ВХОДА (UI) — модалка закрылась, ошибок нет
    cy.get('.p-dialog', { timeout: T.LOGOUT }).should('not.exist');
    cy.get('body', { timeout: T.UI })
      .should('not.contain', 'Неверный логин')
      .and('not.contain', 'Ошибка');

    cy.log('✅ Авторизация прошла успешно');
  });
});
