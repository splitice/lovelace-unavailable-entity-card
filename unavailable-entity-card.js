const CARD_TYPE = "custom:unavailable-entity-card";
const ELEMENT_TAG = "unavailable-entity-card";
const DEFAULT_ICON = "mdi:alert-circle-outline";
const MISSING_ICON = "mdi:help-circle-outline";
const DEFAULT_UNAVAILABLE_STATES = new Set(["unavailable", "unknown"]);

class UnavailableEntityCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = undefined;
    this._hass = undefined;
    this._entities = [];
    this._collapsed = false;
    this._unavailableStates = DEFAULT_UNAVAILABLE_STATES;
    this._stateColors = {};
  }

  static getStubConfig() {
    return {
      type: CARD_TYPE,
      title: "Unavailable Entities",
      entities: ["light.living_room", "sensor.kitchen_temperature"]
    };
  }

  setConfig(config) {
    if (!config || !Array.isArray(config.entities) || config.entities.length === 0) {
      throw new Error("You need to define entities");
    }

    this._config = {
      ...config,
      entities: config.entities.map((entry) => (typeof entry === "string" ? { entity: entry } : entry))
    };

    // expanded defaults to true, so collapsed is the inverse
    const expanded = config.expanded !== undefined ? config.expanded : true;
    this._collapsed = !expanded;
    const unavailableConfig = this._buildUnavailableConfig(config.unavailable_states);
    this._unavailableStates = unavailableConfig.states;
    this._stateColors = unavailableConfig.colors;
    this._entities = this._calculateEntities();
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    const unavailableConfig = this._buildUnavailableConfig(this._config?.unavailable_states);
    this._unavailableStates = unavailableConfig.states;
    this._stateColors = unavailableConfig.colors;
    this._entities = this._calculateEntities();
    this._render();
  }

  get hass() {
    return this._hass;
  }

  getCardSize() {
    if (this._collapsed) {
      return 1;
    }
    const headerRows = this._config && this._config.show_header === false ? 0 : 1;
    const entityRows = this._entities.length || 1;
    return Math.max(1, headerRows + entityRows);
  }

  _calculateEntities() {
    if (!this._config || !this._hass || !this._hass.states) {
      return [];
    }

    const output = [];

    for (const entry of this._config.entities) {
      const entity = this._hass.states[entry.entity];

      if (!entity) {
        output.push({
          id: entry.entity,
          name: entry.name || entry.entity,
          state: "not available",
          icon: entry.icon,
          picture: undefined,
          missing: true
        });
        continue;
      }

      if (!this._unavailableStates.has(entity.state)) {
        continue;
      }

      const attributes = entity.attributes || {};
      const name = entry.name || attributes.friendly_name || entity.entity_id;
      const icon = entry.icon || (typeof attributes.icon === "string" ? attributes.icon : undefined);
      const picture = typeof attributes.entity_picture === "string" ? attributes.entity_picture : undefined;

      output.push({
        id: entity.entity_id,
        name,
        state: entity.state,
        icon,
        picture,
        missing: false
      });
    }

    return output;
  }

  _buildUnavailableConfig(customStates) {
    const states = new Set(DEFAULT_UNAVAILABLE_STATES);
    const colors = {};

    const registerState = (stateKey, styleSource) => {
      const state = typeof stateKey === "string" ? stateKey.trim() : "";
      if (!state) {
        return;
      }
      states.add(state);
      this._setStateStyle(colors, state, styleSource);
    };

    const collectStates = (stateField) => {
      if (Array.isArray(stateField)) {
        return stateField.map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean);
      }
      if (typeof stateField === "string") {
        const trimmed = stateField.trim();
        return trimmed ? [trimmed] : [];
      }
      return [];
    };

    const normalizeEntryStyle = (entry) => {
      if (!entry || typeof entry !== "object") {
        return undefined;
      }
      return {
        background: entry.background,
        color: entry.color,
        border: entry.border,
        value: entry.value
      };
    };

    if (typeof customStates === "string") {
      registerState(customStates, undefined);
    } else if (Array.isArray(customStates)) {
      customStates.forEach((entry) => {
        if (typeof entry === "string") {
          registerState(entry, undefined);
          return;
        }

        if (!entry || typeof entry !== "object") {
          return;
        }

        const statesFromEntry = collectStates(entry.state).concat(collectStates(entry.states));
        if (statesFromEntry.length === 0) {
          return;
        }

        const styleSource = normalizeEntryStyle(entry);
        statesFromEntry.forEach((stateValue) => registerState(stateValue, styleSource));
      });
    } else if (customStates && typeof customStates === "object") {
      Object.entries(customStates).forEach(([stateKey, value]) => {
        if (value === undefined || value === null || typeof value === "boolean") {
          if (value !== false) {
            registerState(stateKey, undefined);
          }
          return;
        }

        if (typeof value === "string") {
          registerState(stateKey, { value });
          return;
        }

        registerState(stateKey, value);
      });
    }

    return { states, colors };
  }

  _setStateStyle(target, stateKey, styleSource) {
    const style = this._normalizeStateStyle(styleSource);
    if (!style) {
      return;
    }
    target[stateKey] = style;
  }

  _normalizeStateStyle(styleSource) {
    if (typeof styleSource === "string") {
      const backgroundOnly = styleSource.trim();
      return backgroundOnly ? { background: backgroundOnly } : undefined;
    }

    if (!styleSource || typeof styleSource !== "object") {
      return undefined;
    }

    const valueAlias = typeof styleSource.value === "string" ? styleSource.value.trim() : undefined;
    const background = typeof styleSource.background === "string" ? styleSource.background.trim() : valueAlias;
    const color = typeof styleSource.color === "string" ? styleSource.color.trim() : undefined;
    const border = typeof styleSource.border === "string" ? styleSource.border.trim() : undefined;

    const normalized = {};
    if (background) {
      normalized.background = background;
    }
    if (color) {
      normalized.color = color;
    }
    if (border) {
      normalized.border = border;
    }

    return Object.keys(normalized).length ? normalized : undefined;
  }

  _getStateStyle(state) {
    if (!state) {
      return "";
    }

    const config = this._stateColors[state];
    if (!config) {
      return "";
    }

    return this._formatStateStyle(config);
  }

  _formatStateStyle(config) {
    if (!config) {
      return "";
    }

    const styles = [];
    if (config.background) {
      styles.push(`background:${this._escapeAttribute(config.background)}`);
    }
    if (config.color) {
      styles.push(`color:${this._escapeAttribute(config.color)}`);
    }
    if (config.border) {
      styles.push(`border:${this._escapeAttribute(config.border)}`);
    }

    return styles.join("; ");
  }

  _render() {
    if (!this.shadowRoot || !this._config) {
      return;
    }

    const style = this._buildStyle();
    const header = this._renderHeader();
    const body = this._collapsed
      ? ""
      : this._entities.length > 0
        ? this._renderEntities()
        : this._renderEmptyState();

    const card = document.createElement("ha-card");
    card.innerHTML = `${header}${body}`;

    this.shadowRoot.innerHTML = "";
    this.shadowRoot.append(style, card);

    card.classList.toggle("collapsed", this._collapsed);

    if (!this._collapsed) {
      this._attachTileHandlers(card);
    }

    this._attachHeaderHandler(card);
  }

  _renderHeader() {
    if (this._config.show_header === false) {
      return "";
    }

    const heading = this._escapeHtml(this._config.title ?? "Unavailable entities");
    const count = this._entities.length;
    const countMarkup = count ? `<span class="entity-count">${count}</span>` : "";
    const icon = this._collapsed ? "mdi:chevron-right" : "mdi:chevron-down";

    return `
      <div class="card-header" role="button" tabindex="0" data-action="toggle" aria-expanded="${this._collapsed ? "false" : "true"}">
        <div class="header-content">
          <span class="header-title">${heading}</span>
          ${countMarkup}
        </div>
        <ha-icon class="collapse-icon" icon="${icon}"></ha-icon>
      </div>
    `;
  }

  _renderEntities() {
    const items = this._entities
      .map((entity) => {
        const stateClass = entity.missing ? "entity-state missing" : "entity-state";
        const stateStyle = this._getStateStyle(entity.state);
        const styleAttribute = stateStyle ? ` style="${stateStyle}"` : "";
        return `
          <div class="entity-tile" role="listitem" data-entity="${this._escapeAttribute(entity.id)}" data-missing="${entity.missing ? "true" : "false"}">
            ${this._renderEntityVisual(entity)}
            <div class="entity-meta">
              <p class="entity-name">${this._escapeHtml(entity.name)}</p>
              <p class="entity-id">${this._escapeHtml(entity.id)}</p>
            </div>
            <span class="${stateClass}"${styleAttribute}>${this._escapeHtml(entity.state)}</span>
          </div>
        `;
      })
      .join("");

    return `
      <div class="entity-list" role="list">
        ${items}
      </div>
    `;
  }

  _renderEntityVisual(entity) {
    if (entity.picture) {
      return `
        <div class="entity-visual">
          <img src="${this._escapeAttribute(entity.picture)}" alt="${this._escapeAttribute(entity.name)}" />
        </div>
      `;
    }

    const fallbackIcon = entity.missing ? MISSING_ICON : DEFAULT_ICON;
    const icon = this._escapeAttribute(entity.icon || fallbackIcon);
    return `
      <div class="entity-visual" aria-hidden="true">
        <ha-icon icon="${icon}"></ha-icon>
      </div>
    `;
  }

  _renderEmptyState() {
    return `
      <div class="empty-state">
        <strong>All monitored entities look good!</strong>
        <span>No entities are currently reporting unavailable or unknown states.</span>
      </div>
    `;
  }

  _buildStyle() {
    const style = document.createElement("style");
    style.textContent = `
      :host {
        display: block;
      }

      ha-card {
        padding-top: 0px;
        padding-right: 8px;
        padding-bottom: 8px;
        padding-left: 8px;
        box-sizing: border-box;
        background: var(--ha-card-background, var(--card-background-color));
      }

      ha-card.collapsed {
        padding-bottom: 0px;
      }

      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 8px;
        margin: 0;
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--primary-text-color);
        cursor: pointer;
        user-select: none;
        border-radius: var(--ha-card-border-radius, 12px);
      }

      .card-header:focus-visible {
        outline: none;
        box-shadow: 0 0 0 2px rgba(var(--rgb-primary-color), 0.6);
      }

      .header-content {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }

      .header-title {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .entity-count {
        background: rgba(var(--rgb-primary-color), 0.12);
        color: var(--primary-color);
        font-size: 0.8rem;
        padding: 2px 8px;
        border-radius: 999px;
      }

      .collapse-icon {
        color: var(--secondary-text-color);
        transition: transform 120ms ease;
      }

      .entity-list {
        display: grid;
        gap: 12px;
        grid-template-columns: 1fr;
        margin: 8px 0 0;
      }

      .entity-tile {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 14px;
        padding: 14px 16px;
        border-radius: var(--ha-card-border-radius, 12px);
        background: var(--tile-background, rgba(var(--rgb-secondary-background-color), 0.4));
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
        border: 1px solid rgba(var(--rgb-primary-text-color), 0.05);
        transition: transform 120ms ease, box-shadow 120ms ease;
        outline: none;
      }

      .entity-tile:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
      }

      .entity-tile.interactive {
        cursor: pointer;
      }

      .entity-tile.interactive:focus-visible {
        box-shadow: 0 0 0 2px rgba(var(--rgb-primary-color), 0.6);
      }

      .entity-visual {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        background: var(--tile-icon-background, rgba(var(--rgb-primary-color), 0.12));
        color: var(--tile-icon-color, var(--primary-color));
        overflow: hidden;
      }

      .entity-visual img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .entity-meta {
        overflow: hidden;
      }

      .entity-name {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--primary-text-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .entity-id {
        margin: 2px 0 0;
        font-size: 0.8rem;
        color: var(--secondary-text-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .entity-state {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        font-weight: 600;
        background: rgba(var(--rgb-warning-color), 0.15);
        color: var(--warning-color);
      }

      .entity-state.missing {
        background: rgba(var(--rgb-disabled-color, 189, 189, 189), 0.25);
        color: var(--secondary-text-color);
      }

      .empty-state {
        display: grid;
        place-items: center;
        padding: 32px 16px;
        border-radius: var(--ha-card-border-radius, 12px);
        background: rgba(var(--rgb-secondary-background-color), 0.5);
        color: var(--secondary-text-color);
        text-align: center;
      }

      .empty-state strong {
        display: block;
        margin-bottom: 8px;
        font-size: 1rem;
      }
    `;
    return style;
  }

  _escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      };
      return entities[char] || char;
    });
  }

  _escapeAttribute(value) {
    return this._escapeHtml(value).replace(/`/g, "&#96;");
  }

  _attachHeaderHandler(card) {
    const header = card.querySelector(".card-header[data-action='toggle']");
    if (!header) {
      return;
    }

    const toggle = () => {
      this._collapsed = !this._collapsed;
      this._render();
    };

    header.addEventListener("click", toggle);
    header.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggle();
      }
    });
  }

  _attachTileHandlers(card) {
    const tiles = card.querySelectorAll(".entity-tile[data-entity]");
    tiles.forEach((tile) => {
      const entityId = tile.getAttribute("data-entity");
      const missing = tile.getAttribute("data-missing") === "true";

      if (!entityId || missing) {
        tile.tabIndex = -1;
        return;
      }

      tile.classList.add("interactive");
      tile.tabIndex = 0;

      const openMoreInfo = () => {
        this.dispatchEvent(
          new CustomEvent("hass-more-info", {
            detail: { entityId },
            bubbles: true,
            composed: true
          })
        );
      };

      tile.addEventListener("click", openMoreInfo);
      tile.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openMoreInfo();
        }
      });
    });
  }
}

if (!customElements.get(ELEMENT_TAG)) {
  customElements.define(ELEMENT_TAG, UnavailableEntityCard);
}

const cardEntry = {
  type: CARD_TYPE,
  name: "Unavailable Entity Card",
  description: "Tile-style list of unavailable or unknown entities.",
  preview: true
};

if (window.customCards) {
  const exists = window.customCards.some((card) => card.type === cardEntry.type);
  if (!exists) {
    window.customCards.push(cardEntry);
  }
} else {
  window.customCards = [cardEntry];
}
