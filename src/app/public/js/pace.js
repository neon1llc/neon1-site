// src/app/public/js/pace.js - The landing's section index (shared/page-index.js). Its entries are ordinary #section links,
// so js/views.js glides to them and Back returns. Without this script the page is whole.

import { pageIndex } from "/shared/page-index.js";

const NAMES = { services: "services", projects: "client work", why: "about", process: "process", work: "code", faq: "questions", contact: "contact" };
const items = [...document.querySelectorAll("main .view")].map((el) => ({ el, name: NAMES[el.id] || el.id, href: "#" + el.id }));
pageIndex(items, { top: () => document.querySelector(".n1-bar").getBoundingClientRect().bottom - 1 });
