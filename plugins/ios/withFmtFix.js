const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("@expo/config-plugins");

const PATCH_TAG = "fmt-consteval-fix";
const ANCHOR = "  post_install do |installer|\n";
const RUBY_PATCH = [
  "    fmt_header = File.join(__dir__, 'Pods', 'fmt', 'include', 'fmt', 'base.h')",
  "    if File.exist?(fmt_header)",
  "      fmt_contents = File.read(fmt_header)",
  "      patched_fmt_contents = fmt_contents.gsub(/#\\s*define\\s+FMT_USE_CONSTEVAL\\s+1\\b/, '# define FMT_USE_CONSTEVAL 0')",
  "      if patched_fmt_contents != fmt_contents",
  "        File.write(fmt_header, patched_fmt_contents)",
  "        Pod::UI.puts('Patched fmt/base.h: disabled FMT_USE_CONSTEVAL')",
  "      end",
  "    end",
  "",
].join("\n");

function patchPodfile(podfilePath) {
  const contents = fs.readFileSync(podfilePath, "utf8");

  if (contents.includes(PATCH_TAG)) {
    return;
  }

  if (!contents.includes(ANCHOR)) {
    throw new Error("Could not find post_install hook in ios/Podfile");
  }

  const taggedPatch = `  # ${PATCH_TAG}\n${RUBY_PATCH}`;
  const updatedContents = contents.replace(ANCHOR, `${ANCHOR}${taggedPatch}`);

  fs.writeFileSync(podfilePath, updatedContents);
}

function withFmtFix(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, "Podfile");
      patchPodfile(podfilePath);
      return config;
    },
  ]);
}

module.exports = withFmtFix;
