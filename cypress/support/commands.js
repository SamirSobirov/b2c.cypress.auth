// ***********************************************
// Кастомные команды проекта
// https://on.cypress.io/custom-commands
// ***********************************************

/**
 * Надёжный ввод в поля PrimeVue/Vue.
 *
 * Проблема: после ввода в соседнее поле Vue пересоздаёт ноду инпута.
 * Cypress печатает в старый (отсоединённый) элемент — без ошибки, но и без
 * результата: поле остаётся пустым. Проверено на форме входа metatrip.asia —
 * первый .type() в поле пароля теряется целиком, второй проходит.
 *
 * Решение: перезапрашивать элемент перед каждым действием и повторять ввод,
 * пока значение реально не окажется в поле.
 *
 * @param {string} selector — CSS-селектор поля (учитывает scope cy.within)
 * @param {string} value    — значение для ввода
 * @param {object} options  — { attempts: number, timeout: number, pause: number }
 */
Cypress.Commands.add('fillInput', (selector, value, options = {}) => {
  // timeout с запасом: на медленном CI-раннере поле появляется не мгновенно
  // pause — видимая в логе пауза, даёт Vue доперерисовать ноду перед вводом
  const { attempts = 4, timeout = 30000, pause = 300 } = options;

  const attempt = (n) => {
    // каждый шаг — со свежим запросом ноды, чтобы не попасть в detached-элемент.
    // timeout нужен и самим экшенам: у clear/type свой лимит на проверку
    // actionability (поле видимо, не перекрыто, не анимируется).
    cy.get(selector, { timeout }).should('be.visible').clear({ timeout, log: false });
    cy.wait(pause);
    cy.get(selector, { timeout }).type(value, { timeout, delay: 0, log: false });
    cy.wait(pause);

    cy.get(selector, { timeout }).then(($el) => {
      if ($el.val() === value) return;

      if (n >= attempts) {
        throw new Error(
          `🆘 Не удалось заполнить "${selector}" за ${attempts} попыт(ок): ` +
          `в поле "${$el.val()}"`
        );
      }
      attempt(n + 1);
    });
  };

  attempt(1);
});
