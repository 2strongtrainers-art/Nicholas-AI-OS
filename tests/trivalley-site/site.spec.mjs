import { errors, expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const heroId = "#tv-coaching-hero";
const shopPath = "/fitness-guides";
const assessmentPath = "/service-page/start-here-elite-assessment";
const qaQuery = "?utm_source=trivalley_qa";
const guides = [
  {
    name: "Four-Week Dumbbell Strength Starter",
    slug: "four-week-dumbbell-strength-starter",
    price: "$39.00",
  },
  {
    name: "TRX Suspension Strength",
    slug: "trx-suspension-strength",
    price: "$39.00",
  },
  {
    name: "Shoulder Rehab Companion",
    slug: "shoulder-rehab-companion",
    price: "$19.00",
  },
];

async function openHome(page) {
  await page.goto("/" + qaQuery, { waitUntil: "load" });
  const hero = page.locator(heroId);
  await expect(hero.getByRole("heading", { level: 1 })).toHaveText(
    "Personal training in the Tri-Valley. Online coaching.",
  );
  return hero;
}

async function openProduct(page, guide) {
  await page.goto(`/product-page/${guide.slug}${qaQuery}`, { waitUntil: "load" });
  await expect(page.getByRole("heading", { name: guide.name, exact: true })).toBeVisible();
}

async function activateWixControl(control, outcome) {
  await control.click();
  try {
    await outcome.waitFor({ state: "visible", timeout: 6_000 });
  } catch (error) {
    if (!(error instanceof errors.TimeoutError)) throw error;
    // Wix can render these buttons before their interactive handlers are ready.
    if (!(await outcome.isVisible())) await control.click();
    await expect(outcome).toBeVisible();
  }
}

test("coaching homepage renders, fits the viewport, and passes scoped accessibility checks", async ({ page }) => {
  const hero = await openHome(page);
  const photo = hero.getByRole("img", { name: /boxing mitts/ });
  await expect.poll(() => photo.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  for (const name of ["Start with an Assessment", "Shop Fitness Guides"]) {
    const button = hero.getByRole("link", { name, exact: true });
    await expect(button).toBeVisible();
    const fit = await button.evaluate(el => {
      const { left, right, height } = el.getBoundingClientRect();
      return left >= 0 && right <= document.documentElement.clientWidth && height >= 44;
    });
    expect(fit, `${name} should fit the viewport with a usable touch target`).toBe(true);
  }
  const offer = page.locator("#tv-dumbbell-starter-v21");
  await expect(offer.getByRole("heading", { name: /Your dumbbells/ })).toBeVisible();
  expect(await offer.evaluate(el => (
    (document.querySelector("#tv-coaching-hero").compareDocumentPosition(el) &
      Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  ))).toBe(true);
  await expect(hero.getByRole("link", { name: "Explore online coaching", exact: true }))
    .toHaveCSS("text-decoration-line", "underline");
  const accessibility = await new AxeBuilder({ page }).include(heroId)
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(accessibility.violations.map(({ id, nodes }) => ({
    id, targets: nodes.map(node => node.target),
  }))).toEqual([]);
});

test("assessment link reaches the $297 service and booking entry", async ({ page }) => {
  const hero = await openHome(page);
  await hero.getByRole("link", { name: "Start with an Assessment", exact: true }).click();
  await expect(page).toHaveURL(url => url.pathname === assessmentPath);
  await expect(page.getByRole("heading", { name: "Start Here: Elite Assessment", exact: true })).toBeVisible();
  await expect(page.getByText("$297", { exact: true }).first()).toBeVisible();
  await page.waitForLoadState("load");
  const calendar = page.getByRole("heading", { name: "Select a Date and Time", exact: true });
  await activateWixControl(page.getByRole("link", { name: "Book Now", exact: true }).first(), calendar);
  await expect(page).toHaveURL(url => url.pathname === "/booking-calendar/start-here-elite-assessment");
});

test("online coaching links to live Stripe enrollment at $497 per month", async ({ page }) => {
  const hero = await openHome(page);
  await hero.getByRole("link", { name: "Explore online coaching", exact: true }).press("Enter");
  await expect(page).toHaveURL(url => url.pathname === "/coaching");
  const enroll = page.getByRole("link", { name: "Start Online Coaching — $497/month", exact: true });
  await expect(enroll).toBeVisible();
  await expect(enroll).toHaveAttribute("href", /^https:\/\/buy\.stripe\.com\/[^/?#]+/);
});

test("the homepage shop link shows all three guide listings", async ({ page }) => {
  const hero = await openHome(page);
  await hero.getByRole("link", { name: "Shop Fitness Guides", exact: true }).click();
  await expect(page).toHaveURL(url => url.pathname === shopPath);
  for (const guide of guides) {
    await expect(page.getByRole("link", { name: `${guide.name} Price ${guide.price}`, exact: true }))
      .toHaveAttribute("href", new RegExp(`/product-page/${guide.slug}$`));
  }
});

for (const guide of guides) {
  test(`${guide.name} shows its price and opens a readable sample`, async ({ page }) => {
    await openProduct(page, guide);
    const price = page.locator('[data-hook="product-prices-wrapper"]');
    await expect(price.getByText(guide.price, { exact: true })).toBeVisible();
    const sample = price.getByRole("link", {
      name: `Preview a Sample for ${guide.name} (opens in a new tab)`, exact: true,
    });
    await expect(sample).toBeVisible();
    const [preview] = await Promise.all([page.waitForEvent("popup"), sample.click()]);
    await expect(preview).toHaveURL(/^https:\/\/static\.wixstatic\.com\/media\/.+\.jpg$/);
    await expect.poll(() => preview.locator("img").evaluate(img => img.naturalWidth))
      .toBeGreaterThanOrEqual(600);
    await preview.close();
    await expect(page.getByRole("button", { name: "Add to Cart", exact: true })).toBeEnabled();
  });
}

test("the Dumbbell guide can enter a temporary cart and reach the checkout control", async ({ page }) => {
  test.skip(process.env.TRIVALLEY_READ_ONLY === "1", "Scheduled checks leave carts empty");
  await openProduct(page, guides[0]);
  await expect(page.getByRole("link", { name: /Preview a Sample for Four-Week Dumbbell/ })).toBeVisible();
  const viewCart = page.getByRole("button", { name: /^(view|go to) cart$/i })
    .or(page.getByRole("link", { name: /^(view|go to) cart$/i })).filter({ visible: true });
  const checkoutLink = page.getByRole("link", { name: "Checkout", exact: true }).filter({ visible: true });
  const checkoutButton = page.getByRole("button", { name: /^(secure )?checkout$/i }).filter({ visible: true });
  const checkout = checkoutLink.or(checkoutButton);
  const cartWithItems = page.getByRole("button", { name: /^Cart with [1-9]\d* items?$/i }).filter({ visible: true });
  await activateWixControl(page.getByRole("button", { name: "Add to Cart", exact: true }),
    checkout.or(viewCart).or(cartWithItems).first());
  if (!(await checkout.first().isVisible())) {
    if (await viewCart.first().isVisible()) {
      await viewCart.first().click();
    } else {
      // The header count can update before the drawer exposes its checkout link.
      // Follow Wix's cart URL in this session instead of clicking through the drawer.
      const href = await cartWithItems.first().getAttribute("href");
      expect(href, "A populated cart should expose its canonical URL").toBeTruthy();
      const cartUrl = new URL(href, page.url());
      expect(cartUrl.origin).toBe(new URL(page.url()).origin);
      expect(cartUrl.pathname).toBe("/cart-page");
      await page.goto(cartUrl.href, { waitUntil: "load" });
    }
  }
  await expect(checkout.first()).toBeEnabled();
  if (await checkoutLink.first().isVisible()) {
    const validPath = await checkoutLink.first().evaluate(el => {
      const url = new URL(el.getAttribute("href"), location.origin);
      return url.origin === location.origin && url.pathname === "/checkout";
    });
    expect(validPath, "The checkout link should stay on the Wix checkout route").toBe(true);
  }
});
