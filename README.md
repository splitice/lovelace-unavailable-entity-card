# Unavailable Entity Card

A lightweight Lovelace custom card that highlights entities reporting `unavailable` or `unknown`, keeping the native Home Assistant tile look.

## Features

- Monitors a provided list of entities and only renders those that are offline
- Shows friendly name, entity id, current state chip, and entity icon/picture when available
- Gracefully flags entities missing from Home Assistant as `not available`
- Supports custom state strings via `unavailable_states`
- Collapsible header lets you hide the list once you have reviewed it
- Works as a single JavaScript file, no build tools required

## Installation

### HACS

1. In Home Assistant, open **HACS (Community Store) → ⋮ → Custom repositories**.
2. Add this repository as a **Dashboard** type and click **Add**.
3. Locate **Unavailable Entity Card** under **Frontend** and install it.
4. Reload Lovelace resources (or restart Home Assistant) so the module is served.

### Manual

1. Copy `unavailable-entity-card.js` into your `config/www/unavailable-entity-card` folder.
2. Add the resource through **Settings → Dashboards → Resources → +**:

   ```yaml
   lovelace:
     resources:
       - url: /local/unavailable-entity-card/unavailable-entity-card.js
         type: module
   ```
3. Reload the browser cache (`Ctrl/Cmd + Shift + R`).

## Usage

```yaml
type: custom:unavailable-entity-card
title: Critical sensors
entities:
  - sensor.living_room_temperature
  - entity: binary_sensor.garage_door
    name: Garage Door
    icon: mdi:garage
  - sensor.ups_status
unavailable_states:
  - offline
  - error
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `title` | string | `Unavailable entities` | Card header text. Set `show_header: false` to hide. |
| `entities` | array | _(required)_ | Entities to monitor. Objects support `entity`, `name`, `icon`. |
| `unavailable_states` | string or array | `['unavailable', 'unknown']` | Additional state values that count as unavailable. |
| `show_header` | boolean | `true` | Hide the header entirely when set to `false`. |

## Development

No build step is required. Adjust `unavailable-entity-card.js` directly and refresh your dashboard to see changes.

## License

MIT
