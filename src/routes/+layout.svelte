<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import { currentUser } from '$lib/store';
    import { onMount } from 'svelte';
    import { NDKNip07Signer } from "@nostr-dev-kit/ndk";
    import { fetchFollowers } from '$lib/currentUser';

    // move to NDK's nip-07 signer
    async function tryToLoadNip07() {
        if (window.nostr) {
            try {
                $ndk.signer = new NDKNip07Signer();
                $currentUser = await $ndk.signer.user();
                $currentUser.ndk = $ndk;
                console.log('currentUser', $currentUser);

                if ($currentUser) {
                    fetchFollowers();
                }

                $ndk = $ndk;
            } catch (e) {
                alert('no nip-07')
                console.error(e);
            }
        } else {
            alert('It looks like you do not have a NIP-07 extension (like getalby or nos2x; you need to install that in your browser to use Highlighter');
            return;
        }
    }

    onMount(async () => {
        tryToLoadNip07();
        console.log('connecting to ndk');
        await $ndk.connect();
    });
</script>

<slot />

<style>
    @tailwind base;
	@tailwind components;
	@tailwind utilities;
</style>