<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;

class DownloadModels extends Command
{
    protected $signature = 'models:download';

    protected $description = 'Download sample actor GLB models from the three.js examples repository';

    private const BASE_URL = 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf';

    private const MODELS = [
        'tall-adult.glb' => 'Soldier.glb',
        'stocky-adult.glb' => 'RobotExpressive/RobotExpressive.glb',
        'child.glb' => 'Xbot.glb',
    ];

    public function handle(): int
    {
        $dir = public_path('models/actors');
        File::ensureDirectoryExists($dir);

        foreach (self::MODELS as $localName => $remotePath) {
            $dest = "{$dir}/{$localName}";

            if (File::exists($dest)) {
                $this->line("  <comment>Skipping</comment> {$localName} (already exists)");
                continue;
            }

            $this->line("  <info>Downloading</info> {$localName}...");

            $response = Http::withOptions(['sink' => $dest])
                ->get(self::BASE_URL . '/' . $remotePath);

            if (! $response->successful()) {
                $this->error("Failed to download {$localName}: HTTP {$response->status()}");
                return self::FAILURE;
            }
        }

        $this->info('All models downloaded.');

        return self::SUCCESS;
    }
}
